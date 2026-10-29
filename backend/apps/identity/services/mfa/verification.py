from __future__ import annotations

from django.utils import timezone

from apps.identity.authentication.exceptions import (
    MFACodeInvalid,
    MFALockedOut,
)
from apps.identity.choices import SecurityEventType
from apps.identity.events.mfa import (
    MFAVerificationFailed,
    MFAVerified,
)

from .base import BaseMFAService
from .lockout import MFALockoutService
from .recovery import MFARecoveryService


class MFAVerificationService(BaseMFAService):
    """
    Second-factor verification.

    - TOTP: a time step is consumable once per user (DOM-MFA-04).
    - Recovery code: single use, atomic.
    - Failures from either factor feed the one lockout counter (DOM-MFA-05).

    The user's MFA row is locked for the duration so concurrent guesses
    cannot race the counter or reuse a step.
    """

    @classmethod
    def lock_row(cls, user):
        """
        Fetch the user's MFA row under a row lock (must be inside a transaction).
        """

        return (
            cls.UserMFA.objects.select_for_update(of=("self",))
            .select_related("user")
            .filter(user=user)
            .first()
        )

    @classmethod
    @BaseMFAService.transaction.atomic
    def verify(
        cls,
        *,
        user,
        code: str,
        request=None,
    ) -> bool:
        """
        Verify a TOTP code for an account that has MFA enabled.
        """

        mfa = cls.lock_row(user)

        cls.UserMFAValidator.validate_verify(mfa)

        assert mfa is not None  # guaranteed by validate_verify above

        cls.ensure_not_locked(mfa)

        return cls.check_totp(mfa, code, request=request)

    @classmethod
    @BaseMFAService.transaction.atomic
    def verify_recovery_code(
        cls,
        *,
        user,
        code: str,
        request=None,
    ) -> bool:
        """
        Verify (and spend) a recovery code for an account with MFA enabled.
        """

        mfa = cls.lock_row(user)

        cls.UserMFAValidator.validate_verify(mfa)

        assert mfa is not None  # guaranteed by validate_verify above

        cls.ensure_not_locked(mfa)

        if MFARecoveryService.consume(user=user, code=code, request=request):
            cls.record_success(mfa, request=request, method="recovery")
            return True

        cls.record_failure(mfa, request=request, method="recovery")

        return False

    @classmethod
    def verify_second_factor(
        cls,
        *,
        user,
        code: str = "",
        recovery_code: str = "",
        request=None,
    ) -> bool:
        """
        Accept either a TOTP code or a recovery code.
        """

        if recovery_code:
            return cls.verify_recovery_code(
                user=user,
                code=recovery_code,
                request=request,
            )

        return cls.verify(user=user, code=code, request=request)

    @classmethod
    def reauthenticate(
        cls,
        *,
        user,
        password: str,
        code: str = "",
        recovery_code: str = "",
        request=None,
    ):
        """
        Prove it is really the account holder before a sensitive MFA change.

        Needs the password and, when MFA is enabled, a valid second factor.
        One message for every wrong input; a locked second factor raises
        ``MFALockedOut``.
        """

        if not user.check_password(password or ""):
            raise MFACodeInvalid()

        mfa = cls.UserMFASelector.get_by_user(user)

        if mfa is None or not mfa.requires_challenge:
            return

        if not cls.verify_second_factor(
            user=user,
            code=code,
            recovery_code=recovery_code,
            request=request,
        ):
            raise MFACodeInvalid()

    # ------------------------------------------------------------------
    # Building blocks (callers hold the row lock)
    # ------------------------------------------------------------------

    @classmethod
    def ensure_not_locked(cls, mfa):
        if MFALockoutService.is_locked(mfa=mfa):
            raise MFALockedOut()

    @classmethod
    def check_totp(
        cls,
        mfa,
        code: str,
        *,
        request=None,
    ) -> bool:
        step = cls.totp.matching_step(
            secret=mfa.totp_secret,
            code=code,
        )

        replayed = (
            step is not None and mfa.last_used_step is not None and step <= mfa.last_used_step
        )

        if step is None or replayed:
            cls.record_failure(
                mfa,
                request=request,
                method="totp",
                reason="replayed_code" if replayed else "invalid_code",
            )

            return False

        mfa.last_used_step = step
        mfa.last_used_at = timezone.now()

        mfa.save(update_fields=["last_used_step", "last_used_at", "updated_at"])

        cls.record_success(mfa, request=request, method="totp")

        return True

    @classmethod
    def record_success(
        cls,
        mfa,
        *,
        request=None,
        method: str,
    ):
        MFALockoutService.reset(mfa=mfa)

        cls.audit(
            user=mfa.user,
            event_type=SecurityEventType.MFA_VERIFIED,
            description="MFA verified.",
            request=request,
            metadata={"method": method},
        )

        cls.publish(
            MFAVerified(
                user=mfa.user,
                mfa=mfa,
            )
        )

    @classmethod
    def record_failure(
        cls,
        mfa,
        *,
        request=None,
        method: str,
        reason: str = "invalid_code",
    ):
        MFALockoutService.record_failure(mfa=mfa, request=request)

        cls.audit(
            user=mfa.user,
            event_type=SecurityEventType.MFA_FAILED,
            description="MFA verification failed.",
            request=request,
            metadata={"method": method, "reason": reason},
        )

        cls.publish(
            MFAVerificationFailed(
                user=mfa.user,
                mfa=mfa,
            )
        )

    # ------------------------------------------------------------------
    # Lockout passthroughs
    # ------------------------------------------------------------------

    @classmethod
    @BaseMFAService.transaction.atomic
    def unlock(
        cls,
        *,
        user,
    ):
        mfa = cls.lock_row(user)

        return MFALockoutService.reset(mfa=mfa)

    @classmethod
    def is_locked(
        cls,
        *,
        user,
    ) -> bool:
        mfa = cls.UserMFASelector.get_by_user(user)

        if mfa is None:
            return False

        return bool(mfa.locked_until and mfa.locked_until > timezone.now())
