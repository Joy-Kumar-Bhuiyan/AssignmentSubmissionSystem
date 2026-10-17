import os
from pathlib import Path

TEST_DATABASE = Path(__file__).parent / "school_portal_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE.as_posix()}"
os.environ["JWT_SECRET"] = "test-secret-only-not-for-deployment"

import pytest

from app.database import Base, SessionLocal, engine
from app.main import seed_database


@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_database(session)
    yield
    Base.metadata.drop_all(bind=engine)
    if TEST_DATABASE.exists():
        TEST_DATABASE.unlink()
