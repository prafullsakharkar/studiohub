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
    # Directory (LDAP) sign-in, ADR-0039.
    DIRECTORY_UNAVAILABLE = "ldap_unavailable", "Directory unavailable"
    DIRECTORY_OFF = "ldap_disabled", "Directory sign-in off"
    DIRECTORY_AMBIGUOUS = "ldap_ambiguous", "Directory: more than one entry"
    DIRECTORY_NO_EMAIL = "ldap_no_email", "Directory entry has no e-mail"
    DIRECTORY_EMAIL_CONFLICT = "ldap_email_conflict", "E-mail used by a local account"
