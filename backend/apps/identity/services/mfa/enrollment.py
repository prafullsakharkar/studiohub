from __future__ import annotations

from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.identity.authentication.exceptions import MFACodeInvalid
from apps.identity.choices import SecurityEventType
from apps.identity.choices.mfa import (
    MFAMethod,
    MFAStatus,
)
from apps.identity.events.mfa import (
    MFADisabled,
    MFAEnabled,
    MFAEnrollmentStarted,
)

from .base import BaseMFAService
from .lockout import MFALockoutService
from .policies import MFAPolicyService
from .recovery import MFARecoveryService
from .trusted_device import MFATrustedDeviceService
from .verification import MFAVerificationService


class MFAEnrollmentService(BaseMFAService):
    """
    MFA enrollment lifecycle (DOM-MFA-01/02/07).

    ``enroll`` (PENDING) -> ``activate`` with a valid code (ENABLED).
    There is no way to reach ENABLED without presenting a code from the
    secret the server generated. The secret is shown while PENDING only; it
    is never returned for an enabled account.
    """

    @classmethod
    @BaseMFAService.transaction.atomic
    def enroll(
        cls,
        *,
        user,
        method: str = MFAMethod.TOTP,
        request=None,
    ):
        """
        Start (or restart) enrollment with a fresh server-generated secret.

        Refuses when MFA is already enabled so an existing second factor can
        never be silently replaced.
        """

        if method != MFAMethod.TOTP:
            raise ValidationError("Only authenticator-app (TOTP) MFA is supported.")

        cls.UserMFA.objects.get_or_create(user=user)

        mfa = MFAVerificationService.lock_row(user)

        cls.UserMFAValidator.validate_enrollable(mfa)

        assert mfa is not None  # created above

        mfa.primary_method = method
        mfa.totp_secret = cls.totp.generate_secret()
        mfa.status = MFAStatus.PENDING
        mfa.is_verified = False
        mfa.failed_attempts = 0
        mfa.locked_until = None
        mfa.totp_confirmed_at = None
        mfa.last_used_step = None

        mfa.save()

        cls.publish(
            MFAEnrollmentStarted(
                user=user,
                mfa=mfa,
            )
        )

        return mfa

    @classmethod
    @BaseMFAService.transaction.atomic
    def activate(
        cls,
        *,
        user,
        code: str,
        request=None,
    ) -> list[str]:
        """
        Enable MFA after the user proves they hold the pending secret.

        Returns the one-time recovery codes. Raises ``MFACodeInvalid`` for a
        wrong or replayed code and ``MFALockedOut`` after repeated failures.
        """

        mfa = MFAVerificationService.lock_row(user)

        cls.UserMFAValidator.validate_pending(mfa)

        assert mfa is not None  # guaranteed by validate_pending above

        MFAVerificationService.ensure_not_locked(mfa)

        if not MFAVerificationService.check_totp(mfa, code, request=request):
            raise MFACodeInvalid()

        mfa.status = MFAStatus.ENABLED
        mfa.is_verified = True
        mfa.totp_confirmed_at = timezone.now()

        mfa.save(
            update_fields=[
                "status",
                "is_verified",
                "totp_confirmed_at",
                "updated_at",
            ]
        )

        codes = MFARecoveryService.generate(user=user, request=request)

        cls.audit(
            user=user,
            event_type=SecurityEventType.MFA_ENABLED,
            description="MFA enabled.",
            request=request,
            metadata={"method": mfa.primary_method},
        )

        cls.publish(
            MFAEnabled(
                user=user,
                mfa=mfa,
            )
        )

        return codes

    @classmethod
    @BaseMFAService.transaction.atomic
    def disable(
        cls,
        *,
        user,
        request=None,
    ):
        """
        Turn MFA off and discard everything that depended on it.

        Unconditional: callers are responsible for authorizing it (see
        ``disable_with_reauth`` for the self-service path).
        """

        mfa = MFAVerificationService.lock_row(user)

        cls.UserMFAValidator.validate_disable_or_pending(mfa)

        return cls._clear(mfa, request=request, reason="disabled")

    @classmethod
    def disable_with_reauth(
        cls,
        *,
        user,
        password: str,
        code: str = "",
        recovery_code: str = "",
        request=None,
    ):
        """
        Self-service disable: password plus a valid second factor (API-MFA-03).
        """

        if not MFAPolicyService.can_disable(user=user):
            raise PermissionDenied("MFA is required for this account and cannot be disabled.")

        MFAVerificationService.reauthenticate(
            user=user,
            password=password,
            code=code,
            recovery_code=recovery_code,
            request=request,
        )

        return cls.disable(user=user, request=request)

    @classmethod
    @BaseMFAService.transaction.atomic
    def reset(
        cls,
        *,
        user,
        request=None,
    ):
        """
        Administrative reset: forget the user's MFA state entirely.

        The caller (an administrator) must be authorized by the view.
        """

        mfa = MFAVerificationService.lock_row(user)

        if mfa is None:
            return None

        return cls._clear(mfa, request=request, reason="reset")

    @classmethod
    def _clear(cls, mfa, *, request, reason: str):
        user = mfa.user

        mfa.status = MFAStatus.DISABLED
        mfa.is_verified = False
        mfa.totp_secret = ""
        mfa.totp_confirmed_at = None
        mfa.last_used_step = None

        mfa.save()

        MFALockoutService.reset(mfa=mfa)

        MFARecoveryService.revoke_all(user=user)

        MFATrustedDeviceService.revoke_all(user=user)

        cls.audit(
            user=user,
            event_type=SecurityEventType.MFA_DISABLED,
            description=f"MFA {reason}.",
            request=request,
            metadata={"reason": reason},
        )

        cls.publish(
            MFADisabled(
                user=user,
                mfa=mfa,
            )
        )

        return mfa

    @classmethod
    def _pending(cls, user):
        mfa = cls.UserMFASelector.get_by_user(user)

        cls.UserMFAValidator.validate_pending(mfa)

        return mfa

    @classmethod
    def provisioning_uri(
        cls,
        *,
        user,
    ) -> str:
        mfa = cls._pending(user)

        assert mfa is not None  # guaranteed by _pending

        return cls.totp.provisioning_uri(
            secret=mfa.totp_secret,
            email=user.email,
            issuer=cls.ISSUER,
        )

    @classmethod
    def qr_code(
        cls,
        *,
        user,
    ) -> str:
        mfa = cls._pending(user)

        assert mfa is not None  # guaranteed by _pending

        return cls.qr.data_uri(
            email=user.email,
            secret=mfa.totp_secret,
            issuer=cls.ISSUER,
        )
