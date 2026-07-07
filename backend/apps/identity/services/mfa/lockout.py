from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from apps.identity.choices.mfa import MFAStatus
from apps.identity.events.mfa import MFALocked

from .base import BaseMFAService


class MFALockoutService(BaseMFAService):
    """
    Handles MFA lockout policy.
    """

    @classmethod
    def is_locked(cls, *, mfa) -> bool:
        if not mfa.locked_until:
            return False

        if mfa.locked_until <= timezone.now():
            cls.unlock(mfa=mfa)
            return False

        return True

    @classmethod
    def record_failure(cls, *, mfa):
        mfa.failed_attempts += 1

        if mfa.failed_attempts >= cls.MAX_FAILED_ATTEMPTS:
            return cls.lock(mfa=mfa)

        mfa.save(update_fields=["failed_attempts"])

        return mfa

    @classmethod
    def reset(cls, *, mfa):
        mfa.failed_attempts = 0
        mfa.locked_until = None

        if mfa.enabled:
            mfa.status = MFAStatus.ACTIVE
        else:
            mfa.status = MFAStatus.PENDING

        mfa.save(
            update_fields=[
                "failed_attempts",
                "locked_until",
                "status",
            ]
        )

        return mfa

    @classmethod
    def lock(cls, *, mfa):
        mfa.failed_attempts = cls.MAX_FAILED_ATTEMPTS
        mfa.status = MFAStatus.LOCKED
        mfa.locked_until = timezone.now() + timedelta(
            minutes=cls.LOCKOUT_MINUTES,
        )

        mfa.save(
            update_fields=[
                "failed_attempts",
                "status",
                "locked_until",
            ]
        )

        cls.publish(
            MFALocked(
                user=mfa.user,
                mfa=mfa,
            )
        )

        return mfa

    @classmethod
    def unlock(cls, *, mfa):
        mfa.failed_attempts = 0
        mfa.locked_until = None

        if mfa.enabled:
            mfa.status = MFAStatus.ACTIVE
        else:
            mfa.status = MFAStatus.PENDING

        mfa.save(
            update_fields=[
                "failed_attempts",
                "locked_until",
                "status",
            ]
        )

        return mfa

    @classmethod
    def remaining_attempts(cls, *, mfa) -> int:
        remaining = cls.MAX_FAILED_ATTEMPTS - mfa.failed_attempts
        return max(remaining, 0)

    @classmethod
    def lockout_remaining_seconds(cls, *, mfa) -> int:
        if not mfa.locked_until:
            return 0

        seconds = int((mfa.locked_until - timezone.now()).total_seconds())

        return max(seconds, 0)
