# Assignment & Submission Management System

This is the original React + Vite portal with its ASP.NET Core API replaced by a Python FastAPI service. The browser-facing API remains on `http://localhost:5000/api`, so the frontend does not need an API rewrite.

## What is included

- React/Vite user interface retained in `FrontendWeb/`
- FastAPI + SQLAlchemy backend in `BackendPython/`
- JWT authentication and role-based API authorization
- PostgreSQL support for normal use, plus zero-setup SQLite for a quick local demo
- Server-side rules for class visibility, teacher allocations, submission ownership, deadlines, resubmission states, and maximum marks
- Automated workflow tests in `BackendPython/tests/`
- Docker Compose file for PostgreSQL

## Run locally

Requirements: Python 3.11+ and Node.js 20+.

Open one terminal for the API:

```powershell
cd BackendPython
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

The first run creates `BackendPython/school_portal.db` and seeds the following development accounts:

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@school.com | AdminPassword123! |
| Teacher | teacher@school.com | TeacherPassword123! |
| Student | student@school.com | StudentPassword123! |

In a second terminal:

```powershell
cd FrontendWeb
npm install
npm run dev
```

Open `http://localhost:5173`. Interactive API documentation is at `http://localhost:5000/docs`.

## PostgreSQL

Copy `BackendPython/.env.example` to `BackendPython/.env`, use a strong `JWT_SECRET`, and set `DATABASE_URL`. To start a local PostgreSQL container:

```powershell
docker compose up -d database
```

Then use this local URL in `.env`:

```text
DATABASE_URL=postgresql+psycopg://school_portal:change-me-locally@localhost:5432/school_portal
```

## Tests

With the virtual environment activated:

```powershell
cd BackendPython
pytest -q
```

The tests exercise login, class/subject setup, teacher allocation, scoped assignment creation, student visibility/submission, grading, and an unauthorized teacher action.

## Notes on the migration

The Python API deliberately keeps the JSON field names and endpoints used by the existing React app. Unlike the source backend, a teacher can only create, edit, delete, see submissions for, or grade work in a class/subject allocation that belongs to that teacher. The API also prevents lowering an assignment maximum below already awarded marks and blocks a student from editing graded or rejected work.

The seeded passwords are for local evaluation only. Replace them and set a unique `JWT_SECRET` before any deployment.
