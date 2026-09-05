"""
Logging constants.
"""

DEFAULT_LOGGER = "apps"

API_LOGGER = "api"

DB_LOGGER = "database"

AUTH_LOGGER = "authentication"

SECURITY_LOGGER = "security"

AUDIT_LOGGER = "audit"

TASK_LOGGER = "tasks"

SERVICE_NAME = "studiohub"

REDACTED = "***REDACTED***"

# Event-data keys that must never reach log output (ADR-0022 security).
SENSITIVE_KEYS = frozenset(
    {
        "password",
        "passwd",
        "secret",
        "client_secret",
        "token",
        "access_token",
        "refresh_token",
        "id_token",
        "api_key",
        "apikey",
        "private_key",
        "mfa_secret",
        "otp",
        "authorization",
        "cookie",
        "session_key",
        "hashed_password",
        "hashed_key",
        "hashed_token",
    }
)
