from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import ceil

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from .config import settings
from .database import Base, SessionLocal, engine, get_session
from .models import Assignment, ClassRoom, Submission, Subject, SystemSetting, TeacherAllocation, User, utc_now
from .schemas import (
    AllocationCreate, AssignmentUpsert, ClassUpsert, GradeSubmission, LoginRequest,
    PasswordReset, SettingUpsert, StatusUpdate, SubjectUpsert, SubmissionCreate,
    UserCreate, UserUpdate,
)
from .security import create_access_token, get_current_user, hash_password, require_roles, verify_password
from .serializers import allocation_data, assignment_data, class_data, setting_data, submission_data, subject_data, user_data

VALID_ROLES = {"Admin", "Teacher", "Student"}
STUDENT_EDITABLE_STATUSES = {"UnderReview", "Returned"}
TEACHER_STATUS_UPDATES = {"UnderReview", "Returned", "Rejected"}


def api_error(code: int, message: str) -> None:
    raise HTTPException(status_code=code, detail=message)


def message_from_error(error: HTTPException) -> dict:
    return {"message": str(error.detail)}


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def page_data(items: list[dict], total: int, page: int, page_size: int) -> dict:
    return {"totalItems": total, "page": page, "pageSize": page_size, "totalPages": ceil(total / page_size) if total else 0, "data": items}


def create_default_settings(session: Session) -> None:
    defaults = {
        "AcademicYear": "2026-2027",
        "AllowLateSubmissions": "true",
        "MaxFileSizeMB": "10",
        "SystemAnnouncement": "Welcome to School Portal!",
    }
    existing = set(session.scalars(select(SystemSetting.key)).all())
    for key, value in defaults.items():
        if key not in existing:
            session.add(SystemSetting(key=key, value=value))


def seed_database(session: Session) -> None:
    create_default_settings(session)
    if session.scalar(select(func.count()).select_from(User)) == 0:
        session.add_all([
            User(email="admin@school.com", password_hash=hash_password("AdminPassword123!"), role="Admin"),
            User(email="teacher@school.com", password_hash=hash_password("TeacherPassword123!"), role="Teacher"),
            User(email="student@school.com", password_hash=hash_password("StudentPassword123!"), role="Student"),
        ])
    session.commit()


def allocation_exists(session: Session, teacher_email: str, class_id: int | None, subject_id: int | None) -> bool:
    if class_id is None or subject_id is None:
        return False
    return session.scalar(select(TeacherAllocation.id).where(
        TeacherAllocation.teacher_email == teacher_email,
        TeacherAllocation.class_id == class_id,
        TeacherAllocation.subject_id == subject_id,
    )) is not None


def require_assignment_manager(session: Session, assignment: Assignment, user: User) -> None:
    if user.role == "Admin":
        return
    if user.role != "Teacher" or not allocation_exists(session, user.email, assignment.class_id, assignment.subject_id):
        api_error(status.HTTP_403_FORBIDDEN, "You are not allocated to manage this assignment.")


def assignment_available_to_student(assignment: Assignment, user: User) -> bool:
    return not assignment.is_draft and (assignment.class_id is None or assignment.class_id == user.class_id)


def allow_late_submissions(session: Session) -> bool:
    value = session.scalar(select(SystemSetting.value).where(SystemSetting.key == "AllowLateSubmissions"))
    return value is None or value.strip().lower() == "true"


def validate_assignment_links(session: Session, payload: AssignmentUpsert) -> None:
    if payload.class_id is not None and session.get(ClassRoom, payload.class_id) is None:
        api_error(status.HTTP_400_BAD_REQUEST, "The selected class does not exist.")
    if payload.subject_id is not None and session.get(Subject, payload.subject_id) is None:
        api_error(status.HTTP_400_BAD_REQUEST, "The selected subject does not exist.")


def set_assignment_values(item: Assignment, payload: AssignmentUpsert) -> None:
    item.title = payload.title.strip()
    item.description = payload.description.strip()
    item.max_marks = payload.max_marks
    item.due_date = as_utc(payload.due_date) or item.due_date
    item.is_draft = payload.is_draft
    item.class_id = payload.class_id
    item.subject_id = payload.subject_id


app = FastAPI(title="School Portal API", version="1.0.0", description="Role-based assignment and submission management API.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def prepare_database() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_database(session)


@app.exception_handler(HTTPException)
async def http_exception_handler(_, exc: HTTPException):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=exc.status_code, content=message_from_error(exc))


@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok"}


@app.post("/api/auth/login", tags=["auth"])
def login(payload: LoginRequest, session: Session = Depends(get_session)):
    user = session.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        api_error(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return {"token": create_access_token(user), "role": user.role, "email": user.email}


@app.get("/api/classes", tags=["classes"])
def list_classes(_: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return [class_data(item) for item in session.scalars(select(ClassRoom).order_by(ClassRoom.name, ClassRoom.section)).all()]


@app.post("/api/classes", tags=["classes"])
def create_class(payload: ClassUpsert, _: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    item = ClassRoom(name=payload.name.strip(), section=payload.section.strip())
    session.add(item)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        api_error(status.HTTP_409_CONFLICT, "A class with this name and section already exists.")
    session.refresh(item)
    return class_data(item)


@app.delete("/api/classes/{class_id}", tags=["classes"])
def delete_class(class_id: int, _: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    item = session.get(ClassRoom, class_id)
    if item is None:
        api_error(status.HTTP_404_NOT_FOUND, "Class not found.")
    in_use = any((
        session.scalar(select(User.id).where(User.class_id == class_id)),
        session.scalar(select(Assignment.id).where(Assignment.class_id == class_id)),
        session.scalar(select(TeacherAllocation.id).where(TeacherAllocation.class_id == class_id)),
    ))
    if in_use:
        api_error(status.HTTP_409_CONFLICT, "This class is in use and cannot be deleted.")
    session.delete(item)
    session.commit()
    return {"message": "Class deleted"}


@app.get("/api/subjects", tags=["subjects"])
def list_subjects(_: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return [subject_data(item) for item in session.scalars(select(Subject).order_by(Subject.name)).all()]


@app.post("/api/subjects", tags=["subjects"])
def create_subject(payload: SubjectUpsert, _: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    item = Subject(name=payload.name.strip(), code=payload.code.strip().upper())
    session.add(item)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        api_error(status.HTTP_409_CONFLICT, "A subject with this code already exists.")
    session.refresh(item)
    return subject_data(item)


@app.delete("/api/subjects/{subject_id}", tags=["subjects"])
def delete_subject(subject_id: int, _: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    item = session.get(Subject, subject_id)
    if item is None:
        api_error(status.HTTP_404_NOT_FOUND, "Subject not found.")
    in_use = any((
        session.scalar(select(Assignment.id).where(Assignment.subject_id == subject_id)),
        session.scalar(select(TeacherAllocation.id).where(TeacherAllocation.subject_id == subject_id)),
    ))
    if in_use:
        api_error(status.HTTP_409_CONFLICT, "This subject is in use and cannot be deleted.")
    session.delete(item)
    session.commit()
    return {"message": "Subject deleted"}


@app.get("/api/users", tags=["users"])
def list_users(
    page: int = Query(1, ge=1), page_size: int = Query(10, alias="pageSize", ge=1, le=100),
    _: User = Depends(require_roles("Admin")), session: Session = Depends(get_session),
):
    total = session.scalar(select(func.count()).select_from(User)) or 0
    rows = session.scalars(select(User).order_by(User.id).offset((page - 1) * page_size).limit(page_size)).all()
    return page_data([user_data(item) for item in rows], total, page, page_size)


def create_user_record(payload: UserCreate, session: Session) -> User:
    role = payload.role.strip().title()
    if role not in VALID_ROLES:
        api_error(status.HTTP_400_BAD_REQUEST, "Role must be Admin, Teacher, or Student.")
    email = payload.email.lower()
    if session.scalar(select(User.id).where(User.email == email)) is not None:
        api_error(status.HTTP_409_CONFLICT, "Email is already registered.")
    if role == "Student":
        if payload.class_id is None or session.get(ClassRoom, payload.class_id) is None:
            api_error(status.HTTP_400_BAD_REQUEST, "Students must be assigned to an existing class.")
    elif payload.class_id is not None:
        api_error(status.HTTP_400_BAD_REQUEST, "Only students can have a class assignment.")
    item = User(email=email, password_hash=hash_password(payload.password), role=role, class_id=payload.class_id if role == "Student" else None)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@app.post("/api/users", tags=["users"])
def create_user(payload: UserCreate, _: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    return user_data(create_user_record(payload, session))


@app.put("/api/users/{user_id}/reset-password", tags=["users"])
def reset_user_password(user_id: int, payload: PasswordReset, _: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    item = session.get(User, user_id)
    if item is None:
        api_error(status.HTTP_404_NOT_FOUND, "User not found.")
    item.password_hash = hash_password(payload.new_password)
    session.commit()
    return {"message": "Password updated successfully."}


def delete_user_record(user_id: int, actor: User, session: Session) -> dict:
    item = session.get(User, user_id)
    if item is None:
        api_error(status.HTTP_404_NOT_FOUND, "User not found.")
    if item.id == actor.id:
        api_error(status.HTTP_400_BAD_REQUEST, "You cannot delete the account you are using.")
    session.query(TeacherAllocation).filter(TeacherAllocation.teacher_email == item.email).delete()
    session.delete(item)
    session.commit()
    return {"message": "User deleted successfully."}


@app.delete("/api/users/{user_id}", tags=["users"])
def delete_user(user_id: int, actor: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    return delete_user_record(user_id, actor, session)


@app.get("/api/allocations", tags=["allocations"])
def list_allocations(_: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    rows = session.scalars(select(TeacherAllocation).options(joinedload(TeacherAllocation.classroom), joinedload(TeacherAllocation.subject)).order_by(TeacherAllocation.id)).all()
    return [allocation_data(item) for item in rows]


@app.post("/api/allocations", tags=["allocations"])
def create_allocation(payload: AllocationCreate, _: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    teacher = session.scalar(select(User).where(User.email == payload.teacher_email.lower()))
    if teacher is None or teacher.role != "Teacher":
        api_error(status.HTTP_400_BAD_REQUEST, "Teacher email must belong to an existing Teacher account.")
    if session.get(ClassRoom, payload.class_id) is None or session.get(Subject, payload.subject_id) is None:
        api_error(status.HTTP_400_BAD_REQUEST, "Class and subject must exist before a teacher can be allocated.")
    item = TeacherAllocation(teacher_email=teacher.email, class_id=payload.class_id, subject_id=payload.subject_id)
    session.add(item)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        api_error(status.HTTP_409_CONFLICT, "This teacher allocation already exists.")
    session.refresh(item)
    return allocation_data(item)


@app.delete("/api/allocations/{allocation_id}", tags=["allocations"])
def delete_allocation(allocation_id: int, _: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    item = session.get(TeacherAllocation, allocation_id)
    if item is None:
        api_error(status.HTTP_404_NOT_FOUND, "Allocation not found.")
    session.delete(item)
    session.commit()
    return {"message": "Allocation deleted"}


@app.get("/api/settings", tags=["settings"])
def list_settings(_: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return [setting_data(item) for item in session.scalars(select(SystemSetting).order_by(SystemSetting.key)).all()]


def update_setting_record(payload: SettingUpsert, session: Session) -> SystemSetting:
    item = session.scalar(select(SystemSetting).where(SystemSetting.key == payload.key.strip()))
    if item is None:
        item = SystemSetting(key=payload.key.strip(), value=payload.value.strip())
        session.add(item)
    else:
        item.value = payload.value.strip()
    session.commit()
    session.refresh(item)
    return item


@app.post("/api/settings", tags=["settings"])
def update_setting(payload: SettingUpsert, _: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    update_setting_record(payload, session)
    return {"message": "Setting updated successfully"}


@app.get("/api/assignments", tags=["assignments"])
def list_assignments(
    page: int = Query(1, ge=1), page_size: int = Query(10, alias="pageSize", ge=1, le=100),
    user: User = Depends(get_current_user), session: Session = Depends(get_session),
):
    query = select(Assignment).options(joinedload(Assignment.classroom), joinedload(Assignment.subject))
    if user.role == "Student":
        query = query.where(Assignment.is_draft.is_(False), (Assignment.class_id.is_(None) | (Assignment.class_id == user.class_id)))
    elif user.role == "Teacher":
        query = query.where(Assignment.class_id.is_not(None), Assignment.subject_id.is_not(None)).where(
            select(TeacherAllocation.id).where(
                TeacherAllocation.teacher_email == user.email,
                TeacherAllocation.class_id == Assignment.class_id,
                TeacherAllocation.subject_id == Assignment.subject_id,
            ).exists()
        )
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = session.scalars(query.order_by(Assignment.created_date.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return page_data([assignment_data(item) for item in rows], total, page, page_size)


def get_assignment_or_404(assignment_id: int, session: Session) -> Assignment:
    item = session.scalar(select(Assignment).options(joinedload(Assignment.classroom), joinedload(Assignment.subject)).where(Assignment.id == assignment_id))
    if item is None:
        api_error(status.HTTP_404_NOT_FOUND, "Assignment not found.")
    return item


@app.get("/api/assignments/{assignment_id}", tags=["assignments"])
def get_assignment(assignment_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    item = get_assignment_or_404(assignment_id, session)
    if user.role == "Student" and not assignment_available_to_student(item, user):
        api_error(status.HTTP_403_FORBIDDEN, "This assignment is not available to you.")
    if user.role == "Teacher":
        require_assignment_manager(session, item, user)
    return assignment_data(item)


@app.post("/api/assignments", tags=["assignments"])
def create_assignment(payload: AssignmentUpsert, user: User = Depends(require_roles("Teacher", "Admin")), session: Session = Depends(get_session)):
    validate_assignment_links(session, payload)
    if user.role == "Teacher" and not allocation_exists(session, user.email, payload.class_id, payload.subject_id):
        api_error(status.HTTP_403_FORBIDDEN, "Teachers can create assignments only for their allocated class and subject.")
    item = Assignment(created_by_email=user.email, due_date=as_utc(payload.due_date) or utc_now() + timedelta(days=7))
    set_assignment_values(item, payload)
    session.add(item)
    session.commit()
    session.refresh(item)
    return assignment_data(item)


@app.put("/api/assignments/{assignment_id}", tags=["assignments"])
def update_assignment(assignment_id: int, payload: AssignmentUpsert, user: User = Depends(require_roles("Teacher", "Admin")), session: Session = Depends(get_session)):
    item = get_assignment_or_404(assignment_id, session)
    require_assignment_manager(session, item, user)
    validate_assignment_links(session, payload)
    if user.role == "Teacher" and not allocation_exists(session, user.email, payload.class_id, payload.subject_id):
        api_error(status.HTTP_403_FORBIDDEN, "Teachers can move assignments only within their allocated class and subject.")
    highest_mark = session.scalar(select(func.max(Submission.marks)).where(Submission.assignment_id == item.id))
    if highest_mark is not None and payload.max_marks < highest_mark:
        api_error(status.HTTP_400_BAD_REQUEST, "Maximum marks cannot be lower than marks already awarded.")
    set_assignment_values(item, payload)
    session.commit()
    session.refresh(item)
    return assignment_data(item)


@app.delete("/api/assignments/{assignment_id}", tags=["assignments"])
def delete_assignment(assignment_id: int, user: User = Depends(require_roles("Teacher", "Admin")), session: Session = Depends(get_session)):
    item = get_assignment_or_404(assignment_id, session)
    require_assignment_manager(session, item, user)
    session.delete(item)
    session.commit()
    return {"message": "Assignment deleted"}


@app.get("/api/assignments/{assignment_id}/submissions", tags=["assignments"])
def list_assignment_submissions(assignment_id: int, user: User = Depends(require_roles("Teacher", "Admin")), session: Session = Depends(get_session)):
    assignment = get_assignment_or_404(assignment_id, session)
    require_assignment_manager(session, assignment, user)
    rows = session.scalars(select(Submission).where(Submission.assignment_id == assignment_id).order_by(Submission.submitted_at.desc())).all()
    return [submission_data(item) for item in rows]


def submit_or_update(payload: SubmissionCreate, user: User, session: Session) -> Submission:
    assignment = get_assignment_or_404(payload.assignment_id, session)
    if not assignment_available_to_student(assignment, user):
        api_error(status.HTTP_403_FORBIDDEN, "This assignment is not available to you.")
    now = utc_now()
    is_late = assignment.due_date is not None and now > as_utc(assignment.due_date)
    if is_late and not allow_late_submissions(session):
        api_error(status.HTTP_400_BAD_REQUEST, "The deadline has passed and late submissions are disabled.")
    item = session.scalar(select(Submission).where(Submission.assignment_id == assignment.id, Submission.student_email == user.email))
    if item is not None:
        if item.status not in STUDENT_EDITABLE_STATUSES:
            api_error(status.HTTP_409_CONFLICT, "This submission can no longer be edited.")
        item.answer_text = payload.answer_text.strip()
        item.submitted_at = now
        item.is_late = is_late
        item.status = "UnderReview"
    else:
        item = Submission(assignment_id=assignment.id, student_email=user.email, answer_text=payload.answer_text.strip(), submitted_at=now, is_late=is_late, status="UnderReview")
        session.add(item)
    session.commit()
    session.refresh(item)
    return item


@app.post("/api/submissions", tags=["submissions"])
def create_submission(payload: SubmissionCreate, user: User = Depends(require_roles("Student")), session: Session = Depends(get_session)):
    return submission_data(submit_or_update(payload, user, session))


@app.put("/api/submissions/{submission_id}", tags=["submissions"])
def update_submission(submission_id: int, payload: SubmissionCreate, user: User = Depends(require_roles("Student")), session: Session = Depends(get_session)):
    if payload.assignment_id <= 0:
        api_error(status.HTTP_400_BAD_REQUEST, "A valid assignment is required.")
    current = session.get(Submission, submission_id)
    if current is None or current.student_email != user.email:
        api_error(status.HTTP_404_NOT_FOUND, "Submission not found.")
    if current.assignment_id != payload.assignment_id:
        api_error(status.HTTP_400_BAD_REQUEST, "A submission cannot be moved to another assignment.")
    return submission_data(submit_or_update(payload, user, session))


@app.get("/api/submissions/my", tags=["submissions"])
def my_submissions(user: User = Depends(require_roles("Student")), session: Session = Depends(get_session)):
    rows = session.scalars(select(Submission).where(Submission.student_email == user.email).order_by(Submission.submitted_at.desc())).all()
    return [submission_data(item) for item in rows]


@app.get("/api/submissions", tags=["submissions"])
def list_submissions(
    page: int = Query(1, ge=1), page_size: int = Query(10, alias="pageSize", ge=1, le=100),
    user: User = Depends(require_roles("Teacher", "Admin")), session: Session = Depends(get_session),
):
    query = select(Submission).options(joinedload(Submission.assignment))
    if user.role == "Teacher":
        query = query.where(select(TeacherAllocation.id).where(
            TeacherAllocation.teacher_email == user.email,
            TeacherAllocation.class_id == Assignment.class_id,
            TeacherAllocation.subject_id == Assignment.subject_id,
        ).where(Assignment.id == Submission.assignment_id).exists())
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = session.scalars(query.order_by(Submission.submitted_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return page_data([submission_data(item) for item in rows], total, page, page_size)


def get_submission_for_manager(submission_id: int, user: User, session: Session) -> Submission:
    item = session.scalar(select(Submission).options(joinedload(Submission.assignment)).where(Submission.id == submission_id))
    if item is None:
        api_error(status.HTTP_404_NOT_FOUND, "Submission not found.")
    require_assignment_manager(session, item.assignment, user)
    return item


@app.put("/api/submissions/{submission_id}/grade", tags=["submissions"])
def grade_submission(submission_id: int, payload: GradeSubmission, user: User = Depends(require_roles("Teacher", "Admin")), session: Session = Depends(get_session)):
    item = get_submission_for_manager(submission_id, user, session)
    if payload.status not in (None, "Graded"):
        api_error(status.HTTP_400_BAD_REQUEST, "Use the status endpoint for Returned or Rejected submissions.")
    if payload.marks > item.assignment.max_marks:
        api_error(status.HTTP_400_BAD_REQUEST, f"Marks cannot exceed the maximum allowed marks ({item.assignment.max_marks}).")
    item.marks = payload.marks
    item.feedback = payload.feedback.strip()
    item.status = "Graded"
    session.commit()
    session.refresh(item)
    return submission_data(item)


@app.api_route("/api/submissions/{submission_id}/status", methods=["PUT", "PATCH"], tags=["submissions"])
def change_submission_status(submission_id: int, payload: StatusUpdate, user: User = Depends(require_roles("Teacher", "Admin")), session: Session = Depends(get_session)):
    item = get_submission_for_manager(submission_id, user, session)
    requested_status = payload.status.strip()
    if requested_status not in TEACHER_STATUS_UPDATES:
        api_error(status.HTTP_400_BAD_REQUEST, "Status must be UnderReview, Returned, or Rejected. Use grading to set Graded.")
    item.status = requested_status
    if requested_status != "Graded":
        item.marks = None
    session.commit()
    session.refresh(item)
    return submission_data(item)


# Compatibility routes for the older optional AdminPanel component.
@app.get("/api/admin/users", tags=["admin"])
def admin_users(_: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    return [user_data(item) for item in session.scalars(select(User).order_by(User.id)).all()]


@app.post("/api/admin/users", tags=["admin"])
def admin_create_user(payload: UserCreate, _: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    return user_data(create_user_record(payload, session))


@app.put("/api/admin/users/{user_id}", tags=["admin"])
def admin_update_user(user_id: int, payload: UserUpdate, _: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    item = session.get(User, user_id)
    if item is None:
        api_error(status.HTTP_404_NOT_FOUND, "User not found.")
    role = payload.role.strip().title()
    if role not in VALID_ROLES:
        api_error(status.HTTP_400_BAD_REQUEST, "Role must be Admin, Teacher, or Student.")
    existing = session.scalar(select(User).where(User.email == payload.email.lower(), User.id != user_id))
    if existing:
        api_error(status.HTTP_409_CONFLICT, "Email is already registered.")
    if role == "Student" and (payload.class_id is None or session.get(ClassRoom, payload.class_id) is None):
        api_error(status.HTTP_400_BAD_REQUEST, "Students must be assigned to an existing class.")
    item.email, item.role, item.class_id = payload.email.lower(), role, payload.class_id if role == "Student" else None
    if payload.password:
        item.password_hash = hash_password(payload.password)
    session.commit()
    return user_data(item)


@app.delete("/api/admin/users/{user_id}", tags=["admin"])
def admin_delete_user(user_id: int, actor: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    return delete_user_record(user_id, actor, session)


@app.get("/api/admin/classes", tags=["admin"])
def admin_classes(_: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    return list_classes(_, session)


@app.get("/api/admin/subjects", tags=["admin"])
def admin_subjects(_: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    return list_subjects(_, session)


@app.get("/api/admin/settings", tags=["admin"])
def admin_settings(_: User = Depends(require_roles("Admin")), session: Session = Depends(get_session)):
    return list_settings(_, session)
