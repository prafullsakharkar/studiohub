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

    # TLS to PostgreSQL (libpq ``sslmode``): "" leaves the driver default (``prefer``: encrypted if
    # the server offers it, silently plain if not). Production uses ``verify-full`` with the CA that
    # signed the server certificate in DB_SSLROOTCERT (TPN review TM-009).
    db_sslmode: str = Field(default="", alias="DB_SSLMODE")

    db_sslrootcert: str = Field(default="", alias="DB_SSLROOTCERT")

    ####################################################################
    # Redis
    ####################################################################

    redis_host: str = Field(alias="REDIS_HOST")

    redis_port: int = Field(default=6379, alias="REDIS_PORT")

    redis_db: int = Field(default=0, alias="REDIS_DB")

    redis_password: str = Field(default="", alias="REDIS_PASSWORD")

    # TLS to Redis: the cache URL becomes ``rediss://`` and trusts REDIS_CA_CERT (system CAs if empty).
    # CELERY_BROKER_URL and CELERY_RESULT_BACKEND are separate values: give them ``rediss://`` too and
    # they use the same CA.
    redis_tls: bool = Field(default=False, alias="REDIS_TLS")

    redis_ca_cert: str = Field(default="", alias="REDIS_CA_CERT")

    # Make `check --deploy` fail (instead of warn) when the database or Redis link is not encrypted
    # and verified. The production templates turn it on.
    internal_tls_required: bool = Field(default=False, alias="INTERNAL_TLS_REQUIRED")

    ####################################################################
    # Email
    ####################################################################

    email_host: str = Field(alias="EMAIL_HOST")

    email_port: int = Field(default=1025, alias="EMAIL_PORT")

    # How mail leaves the application. Development uses a local catcher (mailpit) without TLS;
    # production uses an authenticated relay with STARTTLS (587) or implicit TLS (465).
    email_backend: str = Field(
        default="django.core.mail.backends.smtp.EmailBackend", alias="EMAIL_BACKEND"
    )

    email_host_user: str = Field(default="", alias="EMAIL_HOST_USER")

    email_host_password: SecretStr = Field(default=SecretStr(""), alias="EMAIL_HOST_PASSWORD")

    email_use_tls: bool = Field(default=False, alias="EMAIL_USE_TLS")

    email_use_ssl: bool = Field(default=False, alias="EMAIL_USE_SSL")

    default_from_email: str = Field(default="noreply@studiohub.local", alias="DEFAULT_FROM_EMAIL")

    # Origin of the web client; the password-reset email links to ``<this>/reset-password?token=``.
    frontend_base_url: str = Field(default="", alias="FRONTEND_BASE_URL")

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

    # Require MFA for every account, not only staff, superusers and external (vendor/client)
    # members. Production templates turn this on.
    mfa_require_all: bool = Field(default=False, alias="MFA_REQUIRE_ALL")

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
    # Uploaded files (attachments)
    ####################################################################

    # URL prefix of an nginx ``internal`` location that maps to MEDIA_ROOT, for example
    # ``/_protected_media``. Empty (default): Django streams the file itself. Either way a file
    # leaves only through an authorized download link; nginx never serves attachments by path.
    media_accel_prefix: str = Field(default="", alias="MEDIA_ACCEL_PREFIX")

    ####################################################################
    # Operator surfaces (off unless switched on)
    ####################################################################

    # Django admin site. Its login does not go through the API's MFA, lockout or throttling, so
    # it is not mounted outside DEBUG unless an operator turns it on.
    admin_enabled: bool = Field(default=False, alias="ADMIN_ENABLED")

    # OpenAPI schema and Swagger UI. When on, the schema still needs an authenticated caller.
    api_docs_enabled: bool = Field(default=False, alias="API_DOCS_ENABLED")

    # Keep accepting API keys / PATs stored with the old digest while they upgrade on use. Turn off
    # once `manage.py legacy_credentials` lists none (or with --revoke); check --deploy warns while on.
    api_key_accept_legacy_hash: bool = Field(default=True, alias="API_KEY_ACCEPT_LEGACY_HASH")

    ####################################################################
    # Sessions
    ####################################################################

    # A session that has made no authenticated request for this long cannot be refreshed and ends.
    # 0 turns the idle limit off. Access tokens last 30 minutes, refresh tokens 7 days (jwt.py).
    session_idle_timeout_minutes: int = Field(default=120, alias="SESSION_IDLE_TIMEOUT_MINUTES")

    ####################################################################
    # Audit retention (days; 0 keeps the rows)
    ####################################################################

    # Audit log and change log: the record of who did what. Keep two years by default.
    audit_retention_days: int = Field(default=730, alias="AUDIT_RETENTION_DAYS")

    # API request telemetry and user-behaviour tracking are high volume and carry IP addresses.
    api_request_retention_days: int = Field(default=180, alias="API_REQUEST_RETENTION_DAYS")

    track_retention_days: int = Field(default=90, alias="TRACK_RETENTION_DAYS")

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
        options: dict[str, str] = {}
        if self.db_sslmode.strip():
            options["sslmode"] = self.db_sslmode.strip()
        if self.db_sslrootcert.strip():
            options["sslrootcert"] = self.db_sslrootcert.strip()

        config: dict[Any, Any] = {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": self.db_name,
            "USER": self.db_user,
            "PASSWORD": self.db_password,
            "HOST": self.db_host,
            "PORT": self.db_port,
        }
        if options:
            config["OPTIONS"] = options
        return config

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

        scheme = "rediss" if self.redis_tls else "redis"

        return (
            f"{scheme}://{auth}" f"{self.redis_host}:" f"{self.redis_port}/" f"{self.redis_db}"
        )


# Required values are provided via environment / .env at runtime.
settings = Settings()  # pyright: ignore[reportCallIssue]
