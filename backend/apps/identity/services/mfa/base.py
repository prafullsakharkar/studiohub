from __future__ import annotations

from django.conf import settings

from apps.core.events import publish
from apps.core.services import BaseService
from apps.identity.authentication.device import TrustedDeviceService
from apps.identity.authentication.qr import QRCodeService
from apps.identity.authentication.recovery import RecoveryCodeService
from apps.identity.authentication.totp import TOTPService
from apps.identity.models import (
    BackupCode,
    TrustedDevice,
    UserMFA,
)
from apps.identity.selectors import (
    BackupCodeSelector,
    TrustedDeviceSelector,
    UserMFASelector,
)
from apps.identity.validators import (
    BackupCodeValidator,
    TrustedDeviceValidator,
    UserMFAValidator,
)


class BaseMFAService(BaseService):
    """
    Base class shared by every MFA service.

    Contains only dependencies and configuration.
    No business logic belongs here.
    """

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------

    ISSUER = getattr(
        settings,
        "MFA_ISSUER_NAME",
        "Atom VFX",
    )

    MAX_FAILED_ATTEMPTS = getattr(
        settings,
        "MFA_MAX_FAILED_ATTEMPTS",
        5,
    )

    LOCKOUT_MINUTES = getattr(
        settings,
        "MFA_LOCKOUT_MINUTES",
        15,
    )

    RECOVERY_CODE_COUNT = getattr(
        settings,
        "MFA_RECOVERY_CODE_COUNT",
        10,
    )

    TRUSTED_DEVICE_DAYS = getattr(
        settings,
        "MFA_TRUSTED_DEVICE_DAYS",
        30,
    )

    # ------------------------------------------------------------------
    # Authentication helpers
    # ------------------------------------------------------------------

    totp = TOTPService

    qr = QRCodeService

    recovery = RecoveryCodeService

    trusted_device = TrustedDeviceService

    # ------------------------------------------------------------------
    # Models
    # ------------------------------------------------------------------

    UserMFA = UserMFA

    BackupCode = BackupCode

    TrustedDevice = TrustedDevice

    # ------------------------------------------------------------------
    # Selectors
    # ------------------------------------------------------------------

    user_mfa_selector = UserMFASelector

    backup_code_selector = BackupCodeSelector

    trusted_device_selector = TrustedDeviceSelector

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------

    user_mfa_validator = UserMFAValidator

    backup_code_validator = BackupCodeValidator

    trusted_device_validator = TrustedDeviceValidator

    # ------------------------------------------------------------------
    # Event Publisher
    # ------------------------------------------------------------------

    publish = staticmethod(publish)
