"""
Base Django settings.

This module assembles all configuration components.
Environment-specific settings (local, docker, production, testing)
should override values defined here.
"""

# ruff: noqa: F401  -- settings aggregator: components are re-exported via `from .base import *`

# ------------------------------------------------------------------------------
# Components
# ------------------------------------------------------------------------------

from config.env import settings

from .components.apps import INSTALLED_APPS
from .components.auth import AUTH_PASSWORD_VALIDATORS, AUTH_USER_MODEL
from .components.cache import CACHES
from .components.celery import (
    CELERY_ACCEPT_CONTENT,
    CELERY_BEAT_SCHEDULE,
    CELERY_BROKER_URL,
    CELERY_RESULT_BACKEND,
    CELERY_RESULT_EXPIRES,
    CELERY_RESULT_SERIALIZER,
    CELERY_TASK_SERIALIZER,
    CELERY_TASK_TIME_LIMIT,
    CELERY_TASK_TRACK_STARTED,
    CELERY_TIMEZONE,
)
from .components.cors import (
    CORS_ALLOW_ALL_ORIGINS,
    CORS_ALLOW_CREDENTIALS,
    CORS_ALLOW_HEADERS,
    CORS_ALLOWED_ORIGINS,
    CSRF_TRUSTED_ORIGINS,
)
from .components.database import DATABASES
from .components.drf import REST_FRAMEWORK, SPECTACULAR_SETTINGS
from .components.internationalization import (
    LANGUAGE_CODE,
    LOCALE_PATHS,
    TIME_ZONE,
    USE_I18N,
    USE_TZ,
)
from .components.jwt import SIMPLE_JWT
from .components.logging import LOGGING_CONFIG
from .components.middleware import MIDDLEWARE
from .components.security import (
    API_KEY_ACCEPT_LEGACY_HASH,
    API_KEY_PEPPER,
    CSRF_COOKIE_HTTPONLY,
    DELIVERY_SECRET_KEYS,
    IDENTITY_CREDENTIAL_TOUCH_SECONDS,
    IDENTITY_MAX_ACTIVE_CREDENTIALS,
    MFA_CHALLENGE_TTL_SECONDS,
    MFA_ENCRYPTION_ENABLED,
    MFA_ENCRYPTION_KEYS,
    MFA_ISSUER_NAME,
    MFA_LOCKOUT_MINUTES,
    MFA_MAX_FAILED_ATTEMPTS,
    MFA_RECOVERY_CODE_COUNT,
    MFA_RECOVERY_CODE_DAYS,
    MFA_REQUIRE_EXTERNAL,
    MFA_REQUIRE_MFA,
    MFA_REQUIRE_STAFF,
    MFA_REQUIRE_SUPERUSER,
    MFA_TRUSTED_DEVICE_COOKIE,
    MFA_TRUSTED_DEVICE_MAX_AGE,
    PASSWORD_HISTORY_COUNT,
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    SECURE_BROWSER_XSS_FILTER,
    SECURE_CONTENT_TYPE_NOSNIFF,
    SECURE_PROXY_SSL_HEADER,
    SECURE_REFERRER_POLICY,
    SESSION_COOKIE_HTTPONLY,
    TRUSTED_PROXY_IPS,
    X_FRAME_OPTIONS,
)
from .components.static import STATIC_ROOT, STATIC_URL
from .components.storage import (
    ATTACHMENT_ALLOWED_EXTENSIONS,
    ATTACHMENT_LINK_TTL_SECONDS,
    ATTACHMENT_MAX_BYTES,
    MEDIA_ACCEL_PREFIX,
    MEDIA_ROOT,
    MEDIA_URL,
    PUBLISHING_STORAGE_MOUNTS,
)
from .components.templates import TEMPLATES
from .logging import LOGGING

# ------------------------------------------------------------------------------
# Rate Limiting Configuration
# ------------------------------------------------------------------------------

RATE_LIMIT_ENABLED = True
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_GLOBAL = 100  # requests per window for anonymous users

# ------------------------------------------------------------------------------
# Core Django Settings
# ------------------------------------------------------------------------------

SECRET_KEY = settings.secret_key

DEBUG = settings.debug

# Operator surfaces: mounted only in DEBUG or when an operator opts in (config/urls.py).
ADMIN_ENABLED = settings.admin_enabled

API_DOCS_ENABLED = settings.api_docs_enabled

ALLOWED_HOSTS = settings.allowed_hosts

ROOT_URLCONF = "config.urls"

WSGI_APPLICATION = "config.wsgi.application"

ASGI_APPLICATION = "config.asgi.application"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
