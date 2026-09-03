"""
Identity user filterset tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.user import User
from apps.identity.tests.factories import UserFactory


class TestUserFilterSet:
    """Tests for UserFilterSet."""

    @pytest.mark.django_db
    def test_filter_by_email(self):
        """Test filter by email."""
        from apps.identity.api.filtersets.user import UserFilterSet

        UserFactory.create(email="test@example.com")

        filterset = UserFilterSet(
            data={"email": "test@example.com"},
            queryset=User.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().email == "test@example.com"

    @pytest.mark.django_db
    def test_filter_by_is_active(self):
        """Test filter by is_active."""
        from apps.identity.api.filtersets.user import UserFilterSet

        active_user = UserFactory.create(is_active=True)
        inactive_user = UserFactory.create(is_active=False)

        filterset = UserFilterSet(
            data={"is_active": True},
            queryset=User.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.filter(pk=active_user.pk).exists()
        assert not filterset.qs.filter(pk=inactive_user.pk).exists()

    @pytest.mark.django_db
    def test_filter_by_is_staff(self):
        """Test filter by is_staff."""
        from apps.identity.api.filtersets.user import UserFilterSet

        staff_user = UserFactory.create(is_staff=True)
        regular_user = UserFactory.create(is_staff=False)

        filterset = UserFilterSet(
            data={"is_staff": True},
            queryset=User.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.filter(pk=staff_user.pk).exists()
        assert not filterset.qs.filter(pk=regular_user.pk).exists()

    @pytest.mark.django_db
    def test_filter_by_is_email_verified(self):
        """Test filter by is_email_verified."""
        from apps.identity.api.filtersets.user import UserFilterSet

        verified_user = UserFactory.create(is_email_verified=True)
        unverified_user = UserFactory.create(is_email_verified=False)

        filterset = UserFilterSet(
            data={"is_email_verified": True},
            queryset=User.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.filter(pk=verified_user.pk).exists()
        assert not filterset.qs.filter(pk=unverified_user.pk).exists()

    @pytest.mark.django_db
    def test_filter_by_search(self):
        """Test filter by search."""
        from apps.identity.api.filtersets.user import UserFilterSet

        UserFactory.create(email="john@example.com")
        UserFactory.create(email="jane@example.com")

        filterset = UserFilterSet(
            data={"email": "john"},
            queryset=User.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1

    @pytest.mark.django_db
    def test_filter_by_ordering(self):
        """Test filter by ordering."""
        from apps.identity.api.filtersets.user import UserFilterSet

        UserFactory.create(email="z@example.com")
        UserFactory.create(email="a@example.com")

        filterset = UserFilterSet(
            data={"ordering": "email"},
            queryset=User.objects.all(),
        )

        assert filterset.is_valid()
        users = filterset.qs
        assert users.first().email == "a@example.com"
