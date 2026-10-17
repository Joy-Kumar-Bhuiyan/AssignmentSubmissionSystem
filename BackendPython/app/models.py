from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ClassRoom(Base):
    __tablename__ = "classes"
    __table_args__ = (UniqueConstraint("name", "section", name="uq_class_name_section"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    section: Mapped[str] = mapped_column(String(50), nullable=False)


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="SET NULL"))
    classroom: Mapped[ClassRoom | None] = relationship()


class TeacherAllocation(Base):
    __tablename__ = "teacher_allocations"
    __table_args__ = (UniqueConstraint("teacher_email", "class_id", "subject_id", name="uq_teacher_scope"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    classroom: Mapped[ClassRoom] = relationship()
    subject: Mapped[Subject] = relationship()


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    value: Mapped[str] = mapped_column(String(500), nullable=False)


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    max_marks: Mapped[int] = mapped_column(Integer, nullable=False)
    created_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_draft: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="SET NULL"))
    subject_id: Mapped[int | None] = mapped_column(ForeignKey("subjects.id", ondelete="SET NULL"))
    created_by_email: Mapped[str] = mapped_column(String(255), nullable=False)
    classroom: Mapped[ClassRoom | None] = relationship()
    subject: Mapped[Subject | None] = relationship()
    submissions: Mapped[list[Submission]] = relationship(cascade="all, delete-orphan", back_populates="assignment")


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("assignment_id", "student_email", name="uq_submission_per_student"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    student_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="UnderReview")
    marks: Mapped[int | None] = mapped_column(Integer)
    feedback: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    is_late: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    assignment: Mapped[Assignment] = relationship(back_populates="submissions")
