"""
Identity login attempt filterset tests.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.identity.models.login_attempt import LoginAttempt
from apps.identity.models.user import User
from apps.identity.tests.factories import LoginAttemptFactory, UserFactory


class TestLoginAttemptFilterSet:
    """Tests for LoginAttemptFilterSet."""

    @pytest.mark.django_db
    def test_filter_by_user(self):
        """Test filter by user."""
        from apps.identity.api.filtersets.login_attempt import LoginAttemptFilterSet

        user = UserFactory.create()
        attempt = LoginAttemptFactory.create(user=user)

        filterset = LoginAttemptFilterSet(
            data={"user": user.id},
            queryset=LoginAttempt.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().user.id == user.id

    @pytest.mark.django_db
    def test_filter_by_success(self):
        """Test filter by success."""
        from apps.identity.api.filtersets.login_attempt import LoginAttemptFilterSet

        successful_attempt = LoginAttemptFactory.create(success=True)
        failed_attempt = LoginAttemptFactory.create(success=False)

        filterset = LoginAttemptFilterSet(
            data={"success": True},
            queryset=LoginAttempt.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.filter(pk=successful_attempt.pk).exists()
        assert not filterset.qs.filter(pk=failed_attempt.pk).exists()

    @pytest.mark.django_db
    def test_filter_by_ip_address(self):
        """Test filter by ip_address."""
        from apps.identity.api.filtersets.login_attempt import LoginAttemptFilterSet

        attempt = LoginAttemptFactory.create(ip_address="192.168.1.1")

        filterset = LoginAttemptFilterSet(
            data={"ip_address": "192.168.1.1"},
            queryset=LoginAttempt.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().ip_address == "192.168.1.1"

    @pytest.mark.django_db
    def test_filter_by_reason(self):
        """Test filter by reason."""
        from apps.identity.api.filtersets.login_attempt import LoginAttemptFilterSet

        attempt = LoginAttemptFactory.create(reason="invalid_credentials")

        filterset = LoginAttemptFilterSet(
            data={"reason": "invalid_credentials"},
            queryset=LoginAttempt.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().reason == "invalid_credentials"

    @pytest.mark.django_db
    def test_filter_by_date_range(self):
        """Test filter by date range."""
        from apps.identity.api.filtersets.login_attempt import LoginAttemptFilterSet

        LoginAttemptFactory.create(attempted_at=timezone.now() - timedelta(days=1))
        LoginAttemptFactory.create(attempted_at=timezone.now())

        filterset = LoginAttemptFilterSet(
            data={
                "start_date": (timezone.now() - timedelta(days=2)).date(),
                "end_date": timezone.now().date(),
            },
            queryset=LoginAttempt.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 2

    @pytest.mark.django_db
    def test_filter_by_ordering(self):
        """Test filter by ordering."""
        from apps.identity.api.filtersets.login_attempt import LoginAttemptFilterSet

        LoginAttemptFactory.create(attempted_at=timezone.now() - timedelta(days=1))
        LoginAttemptFactory.create(attempted_at=timezone.now())

        filterset = LoginAttemptFilterSet(
            data={"ordering": "attempted_at"},
            queryset=LoginAttempt.objects.all(),
        )

        assert filterset.is_valid()
        attempts = filterset.qs
        assert attempts.first().attempted_at <= attempts.last().attempted_at
