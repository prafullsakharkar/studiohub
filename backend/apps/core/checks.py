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


@register(Tags.security, deploy=True)
def mail_is_sent_over_tls(app_configs, **kwargs):
    """
    Password-reset links travel by mail: the relay connection must be encrypted, and the link needs
    the web client's https address (without it the email carries a bare token).
    """

    findings = []
    backend = getattr(settings, "EMAIL_BACKEND", "")

    if backend.endswith("smtp.EmailBackend"):
        use_tls = bool(getattr(settings, "EMAIL_USE_TLS", False))
        use_ssl = bool(getattr(settings, "EMAIL_USE_SSL", False))

        if use_tls and use_ssl:
            findings.append(
                Error(
                    "EMAIL_USE_TLS and EMAIL_USE_SSL are both set; Django accepts only one.",
                    hint="Use EMAIL_USE_TLS=true with port 587, or EMAIL_USE_SSL=true with port 465.",
                    id="core.E003",
                )
            )
        elif not (use_tls or use_ssl):
            findings.append(
                Error(
                    "Mail is sent over SMTP without TLS.",
                    hint="Set EMAIL_USE_TLS=true (port 587) or EMAIL_USE_SSL=true (port 465).",
                    id="core.E003",
                )
            )

    base_url = getattr(settings, "FRONTEND_BASE_URL", "") or ""

    if not base_url.startswith("https://"):
        findings.append(
            Error(
                "FRONTEND_BASE_URL is not an https:// address: reset emails would not carry a usable link.",
                hint="Set FRONTEND_BASE_URL=https://<web client host>.",
                id="core.E004",
            )
        )

    if str(getattr(settings, "DEFAULT_FROM_EMAIL", "")).lower().endswith((".local", ".localhost")):
        findings.append(
            Warning(
                "DEFAULT_FROM_EMAIL is still the development placeholder.",
                hint="Set DEFAULT_FROM_EMAIL to an address the relay may send as.",
                id="core.W003",
            )
        )

    return findings


@register(Tags.security, deploy=True)
def client_address_comes_from_the_proxy(app_configs, **kwargs):
    """
    Behind the reverse proxy every peer is the proxy. Without TRUSTED_PROXY_IPS the recorded client
    address, the per-client throttles and the IP blocklist all see that one address.
    """

    if getattr(settings, "TRUSTED_PROXY_IPS", ()):
        return []

    return [
        Warning(
            "TRUSTED_PROXY_IPS is empty: client IPs in logs, throttles and IP blocks are the proxy's.",
            hint="Set TRUSTED_PROXY_IPS to the proxy's address or network (e.g. the compose backend subnet).",
            id="core.W004",
        )
    ]


@register(Tags.security, deploy=True)
def credential_protection_is_not_weakened(app_configs, **kwargs):
    """
    Two switches trade protection of stored secrets for convenience. Both are fine in development;
    a production start refuses the first and flags the second (TPN review TM-019).
    """

    findings = []

    if not getattr(settings, "MFA_ENCRYPTION_ENABLED", True):
        findings.append(
            Error(
                "MFA_ENCRYPTION_ENABLED is false: TOTP secrets are stored in plaintext.",
                hint="Set MFA_ENCRYPTION_ENABLED=true, then run `manage.py mfa_encrypt_secrets`.",
                id="core.E005",
            )
        )

    if getattr(settings, "API_KEY_ACCEPT_LEGACY_HASH", True):
        findings.append(
            Warning(
                "API keys and tokens stored with the old digest are still accepted.",
                hint=(
                    "Run `manage.py legacy_credentials` to see which remain (--revoke revokes them), "
                    "then set API_KEY_ACCEPT_LEGACY_HASH=false."
                ),
                id="core.W005",
            )
        )

    return findings
