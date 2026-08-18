"""
Identity login attempt manager tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.login_attempt import LoginAttempt
from apps.identity.models.user import User
from apps.identity.tests.factories import LoginAttemptFactory, UserFactory


class TestLoginAttemptManager:
    """Tests for LoginAttemptManager."""

    @pytest.mark.django_db
    def test_active_manager(self):
        """Test active manager."""
        active_attempt = LoginAttemptFactory.create()
        assert LoginAttempt.objects.active().filter(pk=active_attempt.pk).exists()

    @pytest.mark.django_db
    def test_inactive_manager(self):
        """Test inactive manager."""
        inactive_attempt = LoginAttemptFactory.create()
        assert LoginAttempt.objects.inactive().filter(pk=inactive_attempt.pk).exists()

    @pytest.mark.django_db
    def test_successful_manager(self):
        """Test successful manager."""
        successful_attempt = LoginAttemptFactory.create(success=True)
        failed_attempt = LoginAttemptFactory.create(success=False)

        assert LoginAttempt.objects.successful().filter(pk=successful_attempt.pk).exists()
        assert not LoginAttempt.objects.successful().filter(pk=failed_attempt.pk).exists()

    @pytest.mark.django_db
    def test_failed_manager(self):
        """Test failed manager."""
        successful_attempt = LoginAttemptFactory.create(success=True)
        failed_attempt = LoginAttemptFactory.create(success=False)

        assert not LoginAttempt.objects.failed().filter(pk=successful_attempt.pk).exists()
        assert LoginAttempt.objects.failed().filter(pk=failed_attempt.pk).exists()

    @pytest.mark.django_db
    def test_for_user_manager(self):
        """Test for_user manager."""
        user = UserFactory.create()
        attempt = LoginAttemptFactory.create(user=user)

        assert LoginAttempt.objects.for_user(user).filter(pk=attempt.pk).exists()

    @pytest.mark.django_db
    def test_recent_manager(self):
        """Test recent manager."""
        recent_attempt = LoginAttemptFactory.create()
        assert LoginAttempt.objects.recent().filter(pk=recent_attempt.pk).exists()

    @pytest.mark.django_db
    def test_ip_address_manager(self):
        """Test ip_address manager."""
        attempt = LoginAttemptFactory.create(ip_address="192.168.1.1")

        assert LoginAttempt.objects.ip_address("192.168.1.1").filter(pk=attempt.pk).exists()
