"""
Identity login attempt queryset tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.login_attempt import LoginAttempt
from apps.identity.models.user import User
from apps.identity.tests.factories import LoginAttemptFactory, UserFactory


class TestLoginAttemptQuerySet:
    """Tests for LoginAttemptQuerySet."""

    @pytest.mark.django_db
    def test_active_queryset(self):
        """Test active queryset."""
        active_attempt = LoginAttemptFactory.create()
        assert LoginAttempt.objects.active().filter(pk=active_attempt.pk).exists()

    @pytest.mark.django_db
    def test_inactive_queryset(self):
        """Test inactive queryset."""
        inactive_attempt = LoginAttemptFactory.create()
        assert LoginAttempt.objects.inactive().filter(pk=inactive_attempt.pk).exists()

    @pytest.mark.django_db
    def test_successful_queryset(self):
        """Test successful queryset."""
        successful_attempt = LoginAttemptFactory.create(success=True)
        failed_attempt = LoginAttemptFactory.create(success=False)

        assert LoginAttempt.objects.successful().filter(pk=successful_attempt.pk).exists()
        assert not LoginAttempt.objects.successful().filter(pk=failed_attempt.pk).exists()

    @pytest.mark.django_db
    def test_failed_queryset(self):
        """Test failed queryset."""
        successful_attempt = LoginAttemptFactory.create(success=True)
        failed_attempt = LoginAttemptFactory.create(success=False)

        assert not LoginAttempt.objects.failed().filter(pk=successful_attempt.pk).exists()
        assert LoginAttempt.objects.failed().filter(pk=failed_attempt.pk).exists()

    @pytest.mark.django_db
    def test_for_user_queryset(self):
        """Test for_user queryset."""
        user = UserFactory.create()
        attempt = LoginAttemptFactory.create(user=user)

        assert LoginAttempt.objects.for_user(user).filter(pk=attempt.pk).exists()

    @pytest.mark.django_db
    def test_recent_queryset(self):
        """Test recent queryset."""
        recent_attempt = LoginAttemptFactory.create()
        assert LoginAttempt.objects.recent().filter(pk=recent_attempt.pk).exists()

    @pytest.mark.django_db
    def test_ip_address_queryset(self):
        """Test ip_address queryset."""
        attempt = LoginAttemptFactory.create(ip_address="192.168.1.1")

        assert LoginAttempt.objects.ip_address("192.168.1.1").filter(pk=attempt.pk).exists()

    @pytest.mark.django_db
    def test_by_reason_queryset(self):
        """Test by_reason queryset."""
        attempt = LoginAttemptFactory.create(reason="invalid_credentials")

        assert (
            LoginAttempt.objects.by_reason("invalid_credentials")
            .filter(pk=attempt.pk)
            .exists()
        )
