"""
Login History choices.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _


class LoginType(models.TextChoices):
    """
    Login types.
    """
    
    LOGIN = "login", _("Login")
    LOGOUT = "logout", _("Logout")
    PASSWORD_CHANGE = "password_change", _("Password Change")
    PASSWORD_RESET = "password_reset", _("Password Reset")
    MFA_VERIFY = "mfa_verify", _("MFA Verify")
    DEVICE_LOGIN = "device_login", _("Device Login")


class LoginStatus(models.TextChoices):
    """
    Login status.
    """
    
    SUCCESS = "success", _("Success")
    FAILED = "failed", _("Failed")
    EXPIRED = "expired", _("Expired")
    REVOKED = "revoked", _("Revoked")
