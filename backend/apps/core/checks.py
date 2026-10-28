"""
Deployment checks (``manage.py check --deploy``).

They refuse a production start that would leave a shared service open or the signing key weak.
They run only with ``--deploy`` so development and the test suite are not affected;
``start-prod.sh`` runs them before the server starts.
"""

from __future__ import annotations

from urllib.parse import urlsplit

from django.conf import settings
from django.core.checks import Error, Tags, Warning, register

_MIN_SECRET_KEY_LENGTH = 32

_PLACEHOLDER_MARKERS = ("django-insecure", "change_me", "changeme", "ci-only", "insecure")


def _redis_without_password(url: str) -> bool:
    parts = urlsplit(url or "")
    return parts.scheme in {"redis", "rediss"} and not parts.password


@register(Tags.security, deploy=True)
def shared_services_need_credentials(app_configs, **kwargs):
    """Redis carries the permission cache and the task queue: it must be authenticated."""

    findings = []
    locations = {
        "the cache (REDIS_PASSWORD)": (settings.CACHES.get("default", {}) or {}).get(
            "LOCATION", ""
        ),
        "the Celery broker (CELERY_BROKER_URL)": getattr(settings, "CELERY_BROKER_URL", ""),
        "the Celery result backend (CELERY_RESULT_BACKEND)": getattr(
            settings, "CELERY_RESULT_BACKEND", ""
        ),
    }

    for label, url in locations.items():
        if isinstance(url, str) and _redis_without_password(url):
            findings.append(
                Error(
                    f"Redis is configured without a password for {label}.",
                    hint="Use redis://:<password>@host:port/db and start Redis with requirepass.",
                    id="core.E001",
                )
            )

    return findings


@register(Tags.security, deploy=True)
def signing_key_is_not_weak(app_configs, **kwargs):
    """SECRET_KEY signs the access and refresh tokens."""

    key = settings.SECRET_KEY or ""
    lowered = key.lower()

    if len(key) < _MIN_SECRET_KEY_LENGTH or any(
        marker in lowered for marker in _PLACEHOLDER_MARKERS
    ):
        return [
            Error(
                "DJANGO_SECRET_KEY is short or looks like a placeholder.",
                hint='Generate one with: python -c "import secrets; print(secrets.token_urlsafe(64))"',
                id="core.E002",
            )
        ]

    return []


@register(Tags.security, deploy=True)
def operator_surfaces_are_off(app_configs, **kwargs):
    """The admin site and the API docs are opt-in; say so when they are on."""

    findings = []

    if getattr(settings, "ADMIN_ENABLED", False):
        findings.append(
            Warning(
                "The Django admin site is enabled: its login does not use the API's MFA or lockout.",
                hint="Restrict /admin/ by network in the proxy and use it only for break-glass work.",
                id="core.W001",
            )
        )

    if getattr(settings, "API_DOCS_ENABLED", False):
        findings.append(
            Warning(
                "The OpenAPI schema and Swagger UI are enabled.",
                hint="Leave API_DOCS_ENABLED off in production unless an assessor needs them.",
                id="core.W002",
            )
        )

    return findings
