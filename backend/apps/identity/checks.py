from __future__ import annotations

from django.conf import settings
from django.core.checks import Error, Warning, register

from apps.identity import crypto


@register()
def mfa_encryption_key_check(app_configs, **kwargs):
    """
    TOTP secrets are encrypted at rest; without a usable key MFA cannot work
    (it fails closed). Surface that at ``manage.py check``/``migrate`` time:
    an error outside DEBUG, a warning in local development.
    """

    if not crypto.enabled():
        return [
            Warning(
                "MFA_ENCRYPTION_ENABLED is false: TOTP secrets are stored in plaintext.",
                hint="Set MFA_ENCRYPTION_ENABLED=true and run `manage.py mfa_encrypt_secrets`.",
                id="identity.W003",
            )
        ]

    problem = None

    if not getattr(settings, "MFA_ENCRYPTION_KEYS", ()):
        problem = "MFA_ENCRYPTION_KEY is not set: MFA secrets cannot be stored or read."
    else:
        try:
            crypto.encrypt("check")
        except crypto.SecretUnavailable:
            problem = "MFA_ENCRYPTION_KEY is not a valid Fernet key."

    if problem is None:
        return []

    hint = 'Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'

    if settings.DEBUG:
        return [Warning(problem, hint=hint, id="identity.W001")]

    return [Error(problem, hint=hint, id="identity.E001")]


@register()
def api_key_pepper_check(app_configs, **kwargs):
    """
    API key / PAT digests are keyed with API_KEY_PEPPER. Without it no
    credential can be created or (peppered) verified; say so at check time.
    """

    if getattr(settings, "API_KEY_PEPPER", ""):
        return []

    problem = "API_KEY_PEPPER is not set: API keys and PATs cannot be created or verified."
    hint = 'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'

    if settings.DEBUG:
        return [Warning(problem, hint=hint, id="identity.W002")]

    return [Error(problem, hint=hint, id="identity.E002")]
