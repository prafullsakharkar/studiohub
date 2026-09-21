"""
Identity authentication validator throttle tests.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.identity.authentication.exceptions import TooManyLoginAttempts
from apps.identity.models import LoginAttempt
from apps.identity.validators.authentication import AuthenticationValidator


def _record_failures(username: str, ip_address: str, count: int) -> None:
    for _ in range(count):
        LoginAttempt.objects.create(
            username=username,
            ip_address=ip_address,
            user_agent="pytest",
            success=False,
            reason="invalid_credentials",
        )


class TestValidateLoginAttempts:
    """Throttle counts recent failures only (decay window)."""

    @pytest.mark.django_db
    def test_allows_login_below_threshold(self):
        _record_failures("user@example.com", "127.0.0.1", 4)
        # Must not raise.
        AuthenticationValidator.validate_login_attempts(
            username="user@example.com",
            ip_address="127.0.0.1",
        )

    @pytest.mark.django_db
    def test_blocks_at_threshold_within_window(self):
        _record_failures("user@example.com", "127.0.0.1", 5)
        with pytest.raises(TooManyLoginAttempts):
            AuthenticationValidator.validate_login_attempts(
                username="user@example.com",
                ip_address="127.0.0.1",
            )

    @pytest.mark.django_db
    def test_stale_failures_decay(self):
        """Failures older than the window must not lock the account."""
        _record_failures("user@example.com", "127.0.0.1", 7)
        LoginAttempt.objects.filter(username="user@example.com").update(
            attempted_at=timezone.now()
            - timedelta(
                minutes=AuthenticationValidator.MAX_LOGIN_ATTEMPT_WINDOW_MINUTES + 5
            )
        )
        # Must not raise: all failures aged out of the window.
        AuthenticationValidator.validate_login_attempts(
            username="user@example.com",
            ip_address="127.0.0.1",
        )

    @pytest.mark.django_db
    def test_window_is_scoped_per_user_and_ip(self):
        _record_failures("other@example.com", "127.0.0.1", 5)
        _record_failures("user@example.com", "10.0.0.2", 5)
        # Must not raise: no recent failures for this user+ip pair.
        AuthenticationValidator.validate_login_attempts(
            username="user@example.com",
            ip_address="127.0.0.1",
        )
