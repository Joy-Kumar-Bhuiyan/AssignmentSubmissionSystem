from __future__ import annotations

from .models import Assignment, ClassRoom, Submission, Subject, SystemSetting, TeacherAllocation, User


def class_data(item: ClassRoom) -> dict:
    return {"id": item.id, "name": item.name, "section": item.section}


def subject_data(item: Subject) -> dict:
    return {"id": item.id, "name": item.name, "code": item.code}


def user_data(item: User) -> dict:
    return {"id": item.id, "email": item.email, "role": item.role, "classId": item.class_id}


def allocation_data(item: TeacherAllocation) -> dict:
    return {
        "id": item.id,
        "teacherEmail": item.teacher_email,
        "classId": item.class_id,
        "className": f"{item.classroom.name} ({item.classroom.section})",
        "subjectId": item.subject_id,
        "subjectName": item.subject.name,
    }


def assignment_data(item: Assignment) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "maxMarks": item.max_marks,
        "createdDate": item.created_date,
        "dueDate": item.due_date,
        "isDraft": item.is_draft,
        "classId": item.class_id,
        "className": f"{item.classroom.name} ({item.classroom.section})" if item.classroom else "General",
        "subjectId": item.subject_id,
        "subjectName": item.subject.name if item.subject else "General",
    }


def submission_data(item: Submission) -> dict:
    return {
        "id": item.id,
        "assignmentId": item.assignment_id,
        "studentEmail": item.student_email,
        "answerText": item.answer_text,
        "status": item.status,
        "marks": item.marks,
        "feedback": item.feedback,
        "submittedAt": item.submitted_at,
        "isLate": item.is_late,
    }


def setting_data(item: SystemSetting) -> dict:
    return {"id": item.id, "key": item.key, "value": item.value}
