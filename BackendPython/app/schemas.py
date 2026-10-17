from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class Payload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class LoginRequest(Payload):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class UserCreate(Payload):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    role: str
    class_id: int | None = Field(default=None, alias="classId")


class UserUpdate(Payload):
    email: EmailStr
    password: str | None = Field(default=None, min_length=8, max_length=200)
    role: str
    class_id: int | None = Field(default=None, alias="classId")


class PasswordReset(Payload):
    new_password: str = Field(min_length=8, max_length=200, alias="newPassword")


class ClassUpsert(Payload):
    name: str = Field(min_length=1, max_length=100)
    section: str = Field(min_length=1, max_length=50)


class SubjectUpsert(Payload):
    name: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=1, max_length=30)


class AllocationCreate(Payload):
    teacher_email: EmailStr = Field(alias="teacherEmail")
    class_id: int = Field(alias="classId", gt=0)
    subject_id: int = Field(alias="subjectId", gt=0)


class AssignmentUpsert(Payload):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=10_000)
    max_marks: int = Field(alias="maxMarks", ge=1, le=10_000)
    due_date: datetime | None = Field(default=None, alias="dueDate")
    is_draft: bool = Field(default=False, alias="isDraft")
    class_id: int | None = Field(default=None, alias="classId")
    subject_id: int | None = Field(default=None, alias="subjectId")


class SubmissionCreate(Payload):
    assignment_id: int = Field(alias="assignmentId", gt=0)
    answer_text: str = Field(alias="answerText", min_length=1, max_length=20_000)


class GradeSubmission(Payload):
    marks: int = Field(ge=0)
    feedback: str = Field(default="", max_length=10_000)
    status: str | None = None


class StatusUpdate(Payload):
    status: str = Field(min_length=1, max_length=30)


class SettingUpsert(Payload):
    key: str = Field(min_length=1, max_length=100)
    value: str = Field(max_length=500)


class SettingsBatch(Payload):
    root: list[SettingUpsert]
