import asyncio
from datetime import datetime, timedelta, timezone

import httpx

from app.main import app


async def login(client, email, password):
    response = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.json()
    return {"Authorization": f"Bearer {response.json()['token']}"}


async def make_scope(client):
    admin = await login(client, "admin@school.com", "AdminPassword123!")
    class_response = await client.post("/api/classes", headers=admin, json={"name": "Class 10", "section": "A"})
    assert class_response.status_code == 200
    subject_response = await client.post("/api/subjects", headers=admin, json={"name": "Physics", "code": "PHY-10"})
    assert subject_response.status_code == 200
    class_id = class_response.json()["id"]
    subject_id = subject_response.json()["id"]
    student_response = await client.post("/api/users", headers=admin, json={
        "email": "learner@school.com", "password": "LearnerPass123!", "role": "Student", "classId": class_id,
    })
    assert student_response.status_code == 200
    allocation_response = await client.post("/api/allocations", headers=admin, json={
        "teacherEmail": "teacher@school.com", "classId": class_id, "subjectId": subject_id,
    })
    assert allocation_response.status_code == 200
    return admin, class_id, subject_id


def test_student_can_submit_only_visible_assignment_and_teacher_can_grade():
    async def scenario():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            _, class_id, subject_id = await make_scope(client)
            teacher = await login(client, "teacher@school.com", "TeacherPassword123!")
            due_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
            assignment_response = await client.post("/api/assignments", headers=teacher, json={
                "title": "Motion worksheet", "description": "Show your steps.", "maxMarks": 20,
                "dueDate": due_date, "isDraft": False, "classId": class_id, "subjectId": subject_id,
            })
            assert assignment_response.status_code == 200, assignment_response.json()
            assignment_id = assignment_response.json()["id"]

            student = await login(client, "learner@school.com", "LearnerPass123!")
            visible = await client.get("/api/assignments", headers=student)
            assert visible.status_code == 200
            assert [item["id"] for item in visible.json()["data"]] == [assignment_id]

            submission = await client.post("/api/submissions", headers=student, json={"assignmentId": assignment_id, "answerText": "My working"})
            assert submission.status_code == 200, submission.json()
            assert submission.json()["status"] == "UnderReview"

            grade = await client.put(f"/api/submissions/{submission.json()['id']}/grade", headers=teacher, json={"marks": 18, "feedback": "Clear method.", "status": "Graded"})
            assert grade.status_code == 200, grade.json()
            assert grade.json()["status"] == "Graded"
    asyncio.run(scenario())


def test_teacher_cannot_manage_an_unallocated_assignment():
    async def scenario():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            admin, class_id, subject_id = await make_scope(client)
            other_teacher = await client.post("/api/users", headers=admin, json={"email": "other@school.com", "password": "OtherPass123!", "role": "Teacher"})
            assert other_teacher.status_code == 200
            teacher = await login(client, "other@school.com", "OtherPass123!")
            response = await client.post("/api/assignments", headers=teacher, json={
                "title": "Unauthorised", "description": "", "maxMarks": 10,
                "isDraft": False, "classId": class_id, "subjectId": subject_id,
            })
            assert response.status_code == 403
    asyncio.run(scenario())
