from django.db import models


class MFAMethod(models.TextChoices):
    TOTP = "totp", "Authenticator App"
    EMAIL = "email", "Email OTP"
    SMS = "sms", "SMS OTP"
    RECOVERY = "recovery", "Recovery Code"


class MFAPriority(models.TextChoices):
    PRIMARY = "primary", "Primary"
    SECONDARY = "secondary", "Secondary"


class MFAStatus(models.TextChoices):
    ENABLED = "enabled", "Enabled"
    DISABLED = "disabled", "Disabled"
    LOCKED = "locked", "Locked"


class OTPChannel(models.TextChoices):
    EMAIL = "email", "Email"
    SMS = "sms", "SMS"
