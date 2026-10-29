from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.identity.events.login_attempt import (
    AccountLocked as AccountLockedEvent,
)
from apps.identity.events.login_attempt import (
    LoginAttemptFailed,
    LoginAttemptSucceeded,
)
from apps.identity.models import LoginAttempt
from apps.identity.selectors.login_attempt import (
    LoginAttemptSelector,
)
from apps.identity.validators.login_attempt import (
    LoginAttemptValidator,
)

DEFAULT_RETENTION_DAYS = 90


class LoginAttemptService:
    """
    Enterprise login attempt service.
    """

    LOCK_DURATION_MINUTES = 15

    @classmethod
    def record_success(
        cls,
        *,
        user,
        username,
        ip_address,
        user_agent="",
    ):
        """
        Record successful login.
        """

        attempt = LoginAttempt.objects.create(
            user=user,
            username=username,
            ip_address=ip_address,
            user_agent=user_agent,
            success=True,
        )

        LoginAttemptSucceeded.dispatch(
            instance=attempt,
        )

        return attempt

    @classmethod
    def record_failure(
        cls,
        *,
        username,
        ip_address,
        user_agent="",
        reason="",
        user=None,
    ):
        """
        Record failed login.
        """

        attempt = LoginAttempt.objects.create(
            user=user,
            username=username,
            ip_address=ip_address,
            user_agent=user_agent,
            success=False,
            reason=reason,
        )

        LoginAttemptFailed.dispatch(
            instance=attempt,
        )

        failures = cls.failure_count(
            username=username,
        )

        if failures >= LoginAttemptValidator.MAX_ATTEMPTS:
            AccountLockedEvent.dispatch(
                username=username,
            )

        return attempt

    @classmethod
    def failure_count(
        cls,
        *,
        username,
    ):
        """
        Number of recent failures.
        """

        return LoginAttemptSelector.recent_failures(
            username=username,
        ).count()

    @classmethod
    def validate_not_locked(
        cls,
        *,
        username,
    ):
        """
        Raise if account is locked.
        """

        failures = cls.failure_count(
            username=username,
        )

        LoginAttemptValidator.validate_attempts(
            failures,
        )

    @classmethod
    def reset(
        cls,
        *,
        username,
    ):
        """
        Future hook for Redis/cache based counters.
        """
        return True

    # ---------------------------------------------------------
    # Create (used by the LoginAttemptViewSet; rows are never updated)
    # ---------------------------------------------------------

    @classmethod
    def create(
        cls,
        *,
        user=None,
        **validated_data,
    ):
        validated_data.setdefault(
            "username",
            user.email if user else "",
        )

        return LoginAttempt.objects.create(
            user=user,
            **validated_data,
        )

    # ---------------------------------------------------------
    # Retention (the only sanctioned deletion path)
    # ---------------------------------------------------------

    @classmethod
    def purge_expired(
        cls,
        *,
        retention_days=None,
    ) -> int:
        """
        Delete attempts older than the retention window.

        Keyed on ``attempted_at``: ``locked_until`` is never written, so the
        previous cleanup removed nothing. The lockout window (minutes) is far
        shorter than any sane retention, so purging never weakens lockout.
        """

        if retention_days is None:
            retention_days = getattr(
                settings,
                "IDENTITY_LOGIN_ATTEMPT_RETENTION_DAYS",
                DEFAULT_RETENTION_DAYS,
            )

        cutoff = timezone.now() - timedelta(days=retention_days)

        deleted, _ = LoginAttempt.objects.filter(
            attempted_at__lt=cutoff,
        ).delete()

        return deleted
