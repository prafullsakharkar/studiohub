"""
Base Django settings.

This module assembles all configuration components.
Environment-specific settings (local, docker, production, testing)
should override values defined here.
"""

# ------------------------------------------------------------------------------
# Components
# ------------------------------------------------------------------------------

from config.env import settings

from .components.apps import INSTALLED_APPS
from .components.auth import AUTH_PASSWORD_VALIDATORS, AUTH_USER_MODEL

# from .components.auth import AUTH_PASSWORD_VALIDATORS, AUTH_USER_MODEL
from .components.cache import CACHES
from .components.celery import (
    CELERY_ACCEPT_CONTENT,
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
from .components.logging import LOGGING, LOGGING_CONFIG
from .components.middleware import MIDDLEWARE
from .components.security import (
    CSRF_COOKIE_HTTPONLY,
    SECURE_BROWSER_XSS_FILTER,
    SECURE_CONTENT_TYPE_NOSNIFF,
    SECURE_PROXY_SSL_HEADER,
    SECURE_REFERRER_POLICY,
    SESSION_COOKIE_HTTPONLY,
    X_FRAME_OPTIONS,
)
from .components.static import STATIC_ROOT, STATIC_URL
from .components.storage import MEDIA_ROOT, MEDIA_URL
from .components.templates import TEMPLATES
from .logging import LOGGING

# ------------------------------------------------------------------------------
# Core Django Settings
# ------------------------------------------------------------------------------

SECRET_KEY = settings.secret_key

DEBUG = settings.debug

ALLOWED_HOSTS = settings.allowed_hosts

ROOT_URLCONF = "config.urls"

WSGI_APPLICATION = "config.wsgi.application"

ASGI_APPLICATION = "config.asgi.application"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
