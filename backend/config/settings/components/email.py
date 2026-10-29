"""
Outgoing mail.

``config/env.py`` reads these from the environment; until this module existed they were read and then
dropped, so Django fell back to its defaults (a local relay on port 25 without TLS) and the
password-reset link had no base address. ``local.py`` and ``testing.py`` replace the backend.
"""

from config.env import settings

EMAIL_BACKEND = settings.email_backend

EMAIL_HOST = settings.email_host

EMAIL_PORT = settings.email_port

EMAIL_HOST_USER = settings.email_host_user

EMAIL_HOST_PASSWORD = settings.email_host_password.get_secret_value()

EMAIL_USE_TLS = settings.email_use_tls

EMAIL_USE_SSL = settings.email_use_ssl

# A mail server that stalls must not hold a request worker for Django's unlimited default.
EMAIL_TIMEOUT = 10

DEFAULT_FROM_EMAIL = settings.default_from_email

SERVER_EMAIL = settings.default_from_email

FRONTEND_BASE_URL = settings.frontend_base_url.rstrip("/")
