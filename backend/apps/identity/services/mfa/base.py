from __future__ import annotations

from typing import Any

from django.conf import settings
from django.db import transaction

from apps.core.events import publish
from apps.core.services import BaseService
from apps.identity.authentication.device import DeviceTokenService
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

    RECOVERY_CODE_DAYS = getattr(
        settings,
        "MFA_RECOVERY_CODE_DAYS",
        365,
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

    trusted_device = DeviceTokenService

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
    # Selector aliases (services reference these by class name)
    # ------------------------------------------------------------------

    UserMFASelector = UserMFASelector

    BackupCodeSelector = BackupCodeSelector

    TrustedDeviceSelector = TrustedDeviceSelector

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------

    from apps.identity.validators import (  # noqa: E402
        BackupCodeValidator as BackupCodeValidator,
    )
    from apps.identity.validators import (
        TrustedDeviceValidator as TrustedDeviceValidator,
    )
    from apps.identity.validators import (
        UserMFAValidator as UserMFAValidator,
    )

    backup_code_validator = BackupCodeValidator

    user_mfa_validator = UserMFAValidator

    trusted_device_validator = TrustedDeviceValidator

    # ------------------------------------------------------------------
    # Event Publisher
    # ------------------------------------------------------------------

    publish = staticmethod(publish)

    # ------------------------------------------------------------------
    # Transaction
    # ------------------------------------------------------------------

    transaction = transaction

    # ------------------------------------------------------------------
    # Audit
    # ------------------------------------------------------------------

    @classmethod
    def audit(
        cls,
        *,
        user,
        event_type,
        description: str,
        request=None,
        metadata: dict[str, Any] | None = None,
    ):
        """
        Record a security event for an MFA action (best effort).

        Never receives or stores codes, secrets or backup codes.
        """

        from apps.identity.authentication.utils import AuthenticationUtils
        from apps.identity.services.security_event import SecurityEventService

        extra = {}

        if request is not None:
            extra = {
                "ip_address": AuthenticationUtils.get_client_ip(request),
                "user_agent": request.META.get("HTTP_USER_AGENT", ""),
            }

        SecurityEventService.emit(
            user=user,
            event_type=event_type,
            description=description,
            metadata=metadata or {},
            **extra,
        )
