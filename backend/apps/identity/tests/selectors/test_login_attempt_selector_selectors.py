"""
Identity login attempt selector tests.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.identity.models.login_attempt import LoginAttempt
from apps.identity.tests.factories import LoginAttemptFactory, UserFactory


class TestLoginAttemptSelector:
    """Tests for LoginAttemptSelector."""

    @pytest.mark.django_db
    def test_get_login_attempt_by_id(self):
        """Test get_login_attempt_by_id method."""
        attempt = LoginAttemptFactory.create()
        retrieved_attempt = LoginAttempt.objects.get_by_id(attempt.id)
        assert retrieved_attempt.id == attempt.id

    @pytest.mark.django_db
    def test_list_login_attempts(self):
        """Test list_login_attempts method."""
        LoginAttemptFactory.create_batch(5)
        attempts = LoginAttempt.objects.list_login_attempts()
        assert attempts.count() == 5

    @pytest.mark.django_db
    def test_list_login_attempts_with_pagination(self):
        """Test list_login_attempts with pagination."""
        LoginAttemptFactory.create_batch(10)
        attempts = LoginAttempt.objects.list_login_attempts(limit=5, offset=0)
        assert attempts.count() == 5

    @pytest.mark.django_db
    def test_list_login_attempts_with_user(self):
        """Test list_login_attempts with user filter."""
        user = UserFactory.create()
        LoginAttemptFactory.create_batch(3, user=user)
        attempts = LoginAttempt.objects.list_login_attempts(user_id=user.id)
        assert attempts.count() == 3

    @pytest.mark.django_db
    def test_list_login_attempts_with_success_filter(self):
        """Test list_login_attempts with success filter."""
        LoginAttemptFactory.create_batch(3, success=True)
        LoginAttemptFactory.create_batch(2, success=False)
        successful_attempts = LoginAttempt.objects.list_login_attempts(success=True)
        failed_attempts = LoginAttempt.objects.list_login_attempts(success=False)
        assert successful_attempts.count() == 3
        assert failed_attempts.count() == 2

    @pytest.mark.django_db
    def test_list_login_attempts_with_date_range(self):
        """Test list_login_attempts with date range."""
        LoginAttemptFactory.create_batch(3, attempted_at=timezone.now() - timedelta(days=1))
        LoginAttemptFactory.create_batch(2, attempted_at=timezone.now())
        recent_attempts = LoginAttempt.objects.list_login_attempts(
            start_date=timezone.now() - timedelta(days=2),
            end_date=timezone.now(),
        )
        assert recent_attempts.count() == 5

    @pytest.mark.django_db
    def test_count_login_attempts(self):
        """Test count_login_attempts method."""
        LoginAttemptFactory.create_batch(5)
        count = LoginAttempt.objects.count_login_attempts()
        assert count == 5

    @pytest.mark.django_db
    def test_get_login_attempt_with_user(self):
        """Test get_login_attempt_with_user method."""
        attempt = LoginAttemptFactory.create()
        retrieved_attempt = LoginAttempt.objects.get_login_attempt_with_user(attempt.id)
        assert retrieved_attempt.id == attempt.id
        assert hasattr(retrieved_attempt, "user")
