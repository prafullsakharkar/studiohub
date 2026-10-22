from django.db import models


class LoginStatus(models.TextChoices):
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"


class LoginMethod(models.TextChoices):
    PASSWORD = "password", "Password"
    SSO = "sso", "Single Sign-On"
    MFA = "mfa", "Multi-Factor Authentication"
    API_TOKEN = "api_token", "API Token"
    REFRESH_TOKEN = "refresh_token", "Refresh Token"
    IMPERSONATION = "impersonation", "Impersonation"


class LoginAttemptStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"
    LOCKED = "locked", "Locked"


class LoginAttemptReason(models.TextChoices):
    """Why a login attempt failed. Recorded in the attempt ledger only."""

    UNKNOWN_USER = "unknown_user", "Unknown user"
    INVALID_PASSWORD = "invalid_password", "Invalid password"
    USER_INACTIVE = "user_inactive", "User inactive"
    USER_DELETED = "user_deleted", "User deleted"
    USER_LOCKED = "user_locked", "User locked"
    TOO_MANY_ATTEMPTS = "too_many_attempts", "Too many attempts"
