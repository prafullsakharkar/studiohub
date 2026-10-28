"""
Enterprise configuration for StudioHub.

Only this module reads environment variables.

Everything else imports the `settings` object.
"""

from __future__ import annotations

from enum import StrEnum
from pathlib import Path
from typing import Any

from pydantic import Field, SecretStr, computed_field
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

    env_file = mapping.get(env, ".env.local")
    # Return absolute path based on BASE_DIR
    return str(BASE_DIR / env_file)


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
    # Database (PostgreSQL by default; DB_ENGINE=sqlite for local file DB)
    ####################################################################

    db_engine: str = Field(default="postgresql", alias="DB_ENGINE")

    db_sqlite_path: str = Field(default="db.sqlite3", alias="DB_SQLITE_PATH")

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
    # Logging
    ####################################################################

    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    log_format: str = Field(default="", alias="LOG_FORMAT")

    ####################################################################
    # Trusted reverse proxies (client IP resolution)
    ####################################################################

    # Comma-separated IPs / CIDR ranges of proxies allowed to set
    # X-Forwarded-For. Empty (default): REMOTE_ADDR is the client address.
    trusted_proxy_ips: str = Field(default="", alias="TRUSTED_PROXY_IPS")

    ####################################################################
    # MFA secret encryption
    ####################################################################

    # Fernet key(s) (urlsafe base64, 32 bytes) protecting TOTP secrets at
    # rest. Comma-separated for rotation: the first key encrypts, every key
    # decrypts. Empty: MFA secrets cannot be stored or read (fails closed).
    #
    # MFA_ENCRYPTION_ENABLED=false stores new secrets in plaintext (an
    # operator decision; the default is on). Existing encrypted values stay
    # readable while the key is present.
    mfa_encryption_enabled: bool = Field(default=True, alias="MFA_ENCRYPTION_ENABLED")

    mfa_encryption_key: SecretStr = Field(
        default=SecretStr(""), alias="MFA_ENCRYPTION_KEY"
    )

    ####################################################################
    # Delivery passcode encryption
    ####################################################################

    # Fernet key(s) (urlsafe base64, 32 bytes) protecting delivery passcodes at
    # rest. Comma-separated for rotation: the first key encrypts, every key
    # decrypts. Empty: a passcode cannot be set or read (fails closed); a
    # delivery without a passcode is unaffected. Not MFA_ENCRYPTION_KEY: the two
    # secrets have different owners and are rotated separately.
    delivery_secret_key: SecretStr = Field(
        default=SecretStr(""), alias="DELIVERY_SECRET_KEY"
    )

    ####################################################################
    # Published file storage roots
    ####################################################################

    # JSON object {"<storage root code>": "<directory the app server can read>"}, for example
    # {"PROJECTS": "/mnt/projects"}. Only roots listed here have their checksums verified; a
    # root is otherwise registered-only. Empty by default (nothing is read from disk). The
    # codes match publishing StorageRoot.code in any case.
    publishing_storage_mounts: dict[str, str] = Field(
        default_factory=dict, alias="PUBLISHING_STORAGE_MOUNTS"
    )

    ####################################################################
    # API key / personal access token hashing
    ####################################################################

    # Dedicated pepper for HMAC-SHA256 credential digests (not SECRET_KEY).
    # Empty: new credentials cannot be created and peppered ones cannot be
    # verified (fails closed). Changing it invalidates every stored credential.
    api_key_pepper: SecretStr = Field(default=SecretStr(""), alias="API_KEY_PEPPER")

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
    def database(self) -> dict[Any, Any]:
        if self.db_engine.strip().lower() == "sqlite":
            return {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": str(BASE_DIR / self.db_sqlite_path),
            }
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
    def trusted_proxies(self) -> tuple[str, ...]:
        return tuple(
            entry.strip() for entry in self.trusted_proxy_ips.split(",") if entry.strip()
        )

    @property
    def mfa_encryption_keys(self) -> tuple[str, ...]:
        # A plain property (not a computed field) so the keys never appear
        # in a model dump or repr.
        return tuple(
            entry.strip()
            for entry in self.mfa_encryption_key.get_secret_value().split(",")
            if entry.strip()
        )

    @property
    def delivery_secret_keys(self) -> tuple[str, ...]:
        # A plain property, like mfa_encryption_keys: never in a dump or repr.
        return tuple(
            entry.strip()
            for entry in self.delivery_secret_key.get_secret_value().split(",")
            if entry.strip()
        )

    @computed_field
    @property
    def redis_url(self) -> str:
        auth = f":{self.redis_password}@" if self.redis_password else ""

        return (
            f"redis://{auth}" f"{self.redis_host}:" f"{self.redis_port}/" f"{self.redis_db}"
        )


# Required values are provided via environment / .env at runtime.
settings = Settings()  # pyright: ignore[reportCallIssue]
