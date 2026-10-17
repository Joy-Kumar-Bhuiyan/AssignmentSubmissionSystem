from __future__ import annotations

import os

from dotenv import load_dotenv

# Read local development settings when a .env file is present. Environment
# variables supplied by a deployment platform still take precedence.
load_dotenv()


class Settings:
    """Small environment-backed configuration object kept dependency-light."""

    database_url = os.getenv("DATABASE_URL", "sqlite:///./school_portal.db")
    jwt_secret = os.getenv("JWT_SECRET", "replace-this-development-secret-before-deployment")
    jwt_issuer = os.getenv("JWT_ISSUER", "SchoolPortalApi")
    jwt_audience = os.getenv("JWT_AUDIENCE", "SchoolPortalFrontend")
    access_token_minutes = int(os.getenv("ACCESS_TOKEN_MINUTES", "1440"))
    cors_origins = [item.strip() for item in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173"
    ).split(",") if item.strip()]


settings = Settings()
