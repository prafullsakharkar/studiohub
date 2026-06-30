"""
Enterprise configuration for StudioHub.

Only this module reads environment variables.

Everything else imports the `settings` object.
"""

from __future__ import annotations

from enum import StrEnum
from pathlib import Path

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Environment(StrEnum):
    LOCAL = "local"
    DOCKER = "docker"
    TESTING = "testing"
    PRODUCTION = "production"
    CI = "ci"


def discover_env_file() -> str:
    """
    Determine which .env file to load.
    """
    import os

    env = os.getenv("DJANGO_ENV", "local")

    mapping = {
        "local": ".env.local",
        "docker": ".env.docker",
        "testing": ".env.test",
        "production": ".env.production",
        "ci": ".env.ci",
    }

    return mapping.get(env, ".env.local")


class Settings(BaseSettings):
    """
    Global application settings.
    """

    model_config = SettingsConfigDict(
        env_file=discover_env_file(),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    ####################################################################
    # Django
    ####################################################################

    environment: Environment = Field(
        default=Environment.LOCAL,
        alias="DJANGO_ENV",
    )

    secret_key: str = Field(alias="DJANGO_SECRET_KEY")

    debug: bool = Field(default=False, alias="DJANGO_DEBUG")

    allowed_hosts: list[str] = Field(
        default=["localhost"],
        alias="DJANGO_ALLOWED_HOSTS",
    )

    csrf_trusted_origins: list[str] = Field(
        default=[],
        alias="DJANGO_CSRF_TRUSTED_ORIGINS",
    )

    cors_allowed_origins: list[str] = Field(
        default=[],
        alias="DJANGO_CORS_ALLOWED_ORIGINS",
    )

    csrf_trusted_origins: list[str] = Field(
        default=[],
        alias="DJANGO_CSRF_TRUSTED_ORIGINS",
    )
    language_code: str = "en-us"

    time_zone: str = "UTC"

    use_i18n: bool = True

    use_tz: bool = True

    ####################################################################
    # PostgreSQL
    ####################################################################

    db_name: str = Field(alias="DB_NAME")

    db_user: str = Field(alias="DB_USER")

    db_password: str = Field(alias="DB_PASSWORD")

    db_host: str = Field(alias="DB_HOST")

    db_port: int = Field(default=5432, alias="DB_PORT")

    ####################################################################
    # Redis
    ####################################################################

    redis_host: str = Field(alias="REDIS_HOST")

    redis_port: int = Field(default=6379, alias="REDIS_PORT")

    redis_db: int = Field(default=0, alias="REDIS_DB")

    redis_password: str = Field(default="", alias="REDIS_PASSWORD")

    ####################################################################
    # MinIO
    ####################################################################

    minio_endpoint: str = Field(alias="MINIO_ENDPOINT")

    minio_access_key: str = Field(alias="MINIO_ACCESS_KEY")

    minio_secret_key: str = Field(alias="MINIO_SECRET_KEY")

    minio_bucket: str = Field(alias="MINIO_BUCKET")

    minio_secure: bool = Field(default=False, alias="MINIO_SECURE")

    ####################################################################
    # Email
    ####################################################################

    email_host: str = Field(alias="EMAIL_HOST")

    email_port: int = Field(default=1025, alias="EMAIL_PORT")

    ####################################################################
    # Celery
    ####################################################################

    celery_broker_url: str = Field(alias="CELERY_BROKER_URL")

    celery_result_backend: str = Field(alias="CELERY_RESULT_BACKEND")

    ####################################################################
    # Computed Fields
    ####################################################################

    @computed_field
    @property
    def database(self) -> dict:
        return {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": self.db_name,
            "USER": self.db_user,
            "PASSWORD": self.db_password,
            "HOST": self.db_host,
            "PORT": self.db_port,
        }

    @computed_field
    @property
    def redis_url(self) -> str:
        auth = f":{self.redis_password}@" if self.redis_password else ""

        return (
            f"redis://{auth}" f"{self.redis_host}:" f"{self.redis_port}/" f"{self.redis_db}"
        )


settings = Settings()
