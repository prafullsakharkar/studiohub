from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from apps.identity.choices import SecurityEventType
from apps.identity.choices.mfa import MFAStatus
from apps.identity.events.mfa import MFALocked

from .base import BaseMFAService


class MFALockoutService(BaseMFAService):
    """
    The single MFA lockout implementation (DOM-MFA-05).

    ``locked_until`` is the source of truth. A lockout never changes
    ``status``: an enabled account stays enabled, so a locked account can
    neither be treated as "no MFA" nor skip the second factor. Rows that a
    previous version left in ``LOCKED`` are honoured and healed on reset.

    Callers hold the row lock (``select_for_update``) so concurrent guesses
    cannot race the counter.
    """

    @classmethod
    def is_locked(cls, *, mfa) -> bool:
        if not mfa.locked_until:
            return False

        if mfa.locked_until <= timezone.now():
            cls.reset(mfa=mfa)
            return False

        return True

    @classmethod
    def record_failure(cls, *, mfa, request=None):
        mfa.failed_attempts += 1

        if mfa.failed_attempts >= cls.MAX_FAILED_ATTEMPTS:
            return cls.lock(mfa=mfa, request=request)

        mfa.save(update_fields=["failed_attempts", "updated_at"])

        return mfa

    @classmethod
    def lock(cls, *, mfa, request=None):
        mfa.failed_attempts = cls.MAX_FAILED_ATTEMPTS
        mfa.locked_until = timezone.now() + timedelta(
            minutes=cls.LOCKOUT_MINUTES,
        )

        mfa.save(
            update_fields=[
                "failed_attempts",
                "locked_until",
                "updated_at",
            ]
        )

        cls.audit(
            user=mfa.user,
            event_type=SecurityEventType.MFA_LOCKED,
            description="MFA locked after repeated failed verification.",
            request=request,
            metadata={"locked_until": mfa.locked_until.isoformat()},
        )

        cls.publish(
            MFALocked(
                user=mfa.user,
                mfa=mfa,
            )
        )

        return mfa

    @classmethod
    def reset(cls, *, mfa):
        mfa.failed_attempts = 0
        mfa.locked_until = None

        if mfa.status == MFAStatus.LOCKED:
            mfa.status = MFAStatus.ENABLED

        mfa.save(
            update_fields=[
                "failed_attempts",
                "locked_until",
                "status",
                "updated_at",
            ]
        )

        return mfa

    unlock = reset

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
