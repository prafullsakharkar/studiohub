from __future__ import annotations

from django.utils import timezone

from apps.identity.authentication.exceptions import (
    AccountLocked,
)
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
    # CRUD (used by the LoginAttemptViewSet)
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

    @classmethod
    def update(
        cls,
        instance,
        **validated_data,
    ):
        for key, value in validated_data.items():
            setattr(
                instance,
                key,
                value,
            )

        instance.save()

        return instance

    @classmethod
    def delete(
        cls,
        instance,
        **kwargs,
    ):
        instance.delete()
