"""
Outgoing mail.

``config/env.py`` reads these from the environment; until this module existed they were read and then
dropped, so Django fell back to its defaults (a local relay on port 25 without TLS) and the
password-reset link had no base address. ``local.py`` and ``testing.py`` replace the mailer.
"""

from typing import TypedDict

from config.env import settings


class MailerConfig(TypedDict):
    BACKEND: str
    OPTIONS: dict[str, object]


# Django 6.1 replaced the EMAIL_* settings with MAILERS (they are removed in Django 2028) and refuses both together.
# The environment variables keep their names; ``local.py`` and ``testing.py`` replace the whole mailer.
def build_mailers(env) -> dict[str, MailerConfig]:
    """The default mailer from the loaded environment (a function so a test can feed it other values)."""

    options: dict[str, object] = {
        "host": env.email_host,
        "port": env.email_port,
        "use_tls": env.email_use_tls,
        "use_ssl": env.email_use_ssl,
        # A mail server that stalls must not hold a request worker for Django's unlimited default.
        "timeout": 10,
    }

    if env.email_host_user:
        options["username"] = env.email_host_user

    password = env.email_host_password.get_secret_value()

    if password:
        options["password"] = password

    return {"default": {"BACKEND": env.email_backend, "OPTIONS": options}}


MAILERS = build_mailers(settings)

DEFAULT_FROM_EMAIL = settings.default_from_email

SERVER_EMAIL = settings.default_from_email

FRONTEND_BASE_URL = settings.frontend_base_url.rstrip("/")
