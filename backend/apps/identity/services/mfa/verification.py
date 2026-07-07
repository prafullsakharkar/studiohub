from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from apps.identity.authentication.recovery import RecoveryCodeService
from apps.identity.authentication.totp import TOTPService
from apps.identity.choices.mfa import MFAStatus
from apps.identity.events.mfa import (
    BackupCodeUsed,
    MFALocked,
    MFAVerificationFailed,
    MFAVerified,
)

from .base import BaseMFAService


class MFAVerificationService(BaseMFAService):
    """
    MFA verification service.

    Supports:
    - TOTP verification
    - Recovery code verification
    - Failed attempt tracking
    - Account lockout
    """

    @classmethod
    @BaseMFAService.transaction.atomic
    def verify(
        cls,
        *,
        user,
        code: str,
    ) -> bool:
        """
        Verify TOTP code.
        """

        mfa = cls.UserMFASelector.get_by_user(user)

        cls.UserMFAValidator.validate_verify(mfa)

        if TOTPService.verify(
            secret=mfa.secret,
            code=code,
        ):
            cls.reset_failed_attempts(mfa)

            cls.publish(
                MFAVerified(
                    user=user,
                    mfa=mfa,
                )
            )

            return True

        cls.record_failed_attempt(mfa)

        cls.publish(
            MFAVerificationFailed(
                user=user,
                mfa=mfa,
            )
        )

        return False

    @classmethod
    @BaseMFAService.transaction.atomic
    def verify_recovery_code(
        cls,
        *,
        user,
        code: str,
    ) -> bool:
        """
        Verify recovery code.
        """

        backup_codes = cls.BackupCodeSelector.get_available(
            user=user,
        )

        for backup in backup_codes:

            if RecoveryCodeService.verify(
                code=code,
                hashed_code=backup.code_hash,
            ):
                backup.used = True
                backup.used_at = timezone.now()

                backup.save(
                    update_fields=[
                        "used",
                        "used_at",
                    ]
                )

                cls.reset_failed_attempts(
                    cls.UserMFASelector.get_by_user(user),
                )

                cls.publish(
                    BackupCodeUsed(
                        user=user,
                        backup_code=backup,
                    )
                )

                return True

        return False

    @classmethod
    def record_failed_attempt(
        cls,
        mfa,
    ):
        """
        Increment failed attempts.
        """

        mfa.failed_attempts += 1

        if mfa.failed_attempts >= cls.MAX_FAILED_ATTEMPTS:
            cls.lock(mfa)
            return

        mfa.save(
            update_fields=[
                "failed_attempts",
            ]
        )

    @classmethod
    def reset_failed_attempts(
        cls,
        mfa,
    ):
        """
        Reset failure counters.
        """

        mfa.failed_attempts = 0
        mfa.locked_until = None
        mfa.last_verified_at = timezone.now()

        if mfa.status == MFAStatus.LOCKED:
            mfa.status = MFAStatus.ACTIVE

        mfa.save(
            update_fields=[
                "failed_attempts",
                "locked_until",
                "last_verified_at",
                "status",
            ]
        )

    @classmethod
    def lock(
        cls,
        mfa,
    ):
        """
        Lock MFA.
        """

        mfa.status = MFAStatus.LOCKED

        mfa.locked_until = timezone.now() + timedelta(
            minutes=cls.LOCKOUT_MINUTES,
        )

        mfa.save(
            update_fields=[
                "status",
                "locked_until",
                "failed_attempts",
            ]
        )

        cls.publish(
            MFALocked(
                user=mfa.user,
                mfa=mfa,
            )
        )

    @classmethod
    def unlock(
        cls,
        *,
        user,
    ):
        """
        Unlock MFA.
        """

        mfa = cls.UserMFASelector.get_by_user(user)

        mfa.failed_attempts = 0
        mfa.locked_until = None
        mfa.status = MFAStatus.ACTIVE

        mfa.save(
            update_fields=[
                "failed_attempts",
                "locked_until",
                "status",
            ]
        )

        return mfa

    @classmethod
    def is_locked(
        cls,
        *,
        user,
    ) -> bool:
        """
        Check whether MFA is currently locked.
        """

        mfa = cls.UserMFASelector.get_by_user(user)

        if not mfa.locked_until:
            return False

        return mfa.locked_until > timezone.now()
