from __future__ import annotations

import pytest
from django.utils import timezone

from apps.identity.authentication.exceptions import TooManyLoginAttempts
from apps.identity.models import LoginAttempt
from apps.identity.validators.authentication import (
    AuthenticationValidator,
)

MAX_ATTEMPTS = AuthenticationValidator.MAX_LOGIN_ATTEMPTS  # 5
WINDOW = AuthenticationValidator.MAX_LOGIN_ATTEMPT_WINDOW_MINUTES  # 15


def _fail(username: str, ip: str, minutes_ago: int = 0) -> None:
    attempt = LoginAttempt.objects.create(
        username=username,
        ip_address=ip,
        success=False,
    )
    if minutes_ago:
        # ``attempted_at`` is ``auto_now_add`` and would overwrite any value
        # passed to ``create()``, so backdate it via ``update()`` instead.
        LoginAttempt.objects.filter(pk=attempt.pk).update(
            attempted_at=timezone.now() - timezone.timedelta(minutes=minutes_ago),
        )


@pytest.mark.django_db
class TestUsernameOnlyLockout:
    def test_lockout_counts_same_username_across_ips(self):
        # 5 failures for one username spread over 5 different IPs must lock.
        for i in range(MAX_ATTEMPTS):
            _fail("victim@example.com", f"10.0.{i}.1")

        with pytest.raises(TooManyLoginAttempts):
            AuthenticationValidator.validate_login_attempts(
                username="victim@example.com",
                ip_address="10.9.9.9",
            )

    def test_distinct_usernames_at_same_ip_do_not_lock(self):
        # 5 failures across 5 different usernames at one IP must NOT lock.
        for i in range(MAX_ATTEMPTS):
            _fail(f"user{i}@example.com", "10.0.0.1")

        AuthenticationValidator.validate_login_attempts(
            username="fresh@example.com",
            ip_address="10.0.0.1",
        )  # must not raise

    def test_old_failures_do_not_count(self):
        for _ in range(MAX_ATTEMPTS):
            _fail("victim@example.com", "10.0.0.1", minutes_ago=WINDOW + 1)

        AuthenticationValidator.validate_login_attempts(
            username="victim@example.com",
            ip_address="10.0.0.1",
        )  # must not raise
