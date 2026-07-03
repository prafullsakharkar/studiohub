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
