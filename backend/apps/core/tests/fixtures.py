"""
Core test fixtures.
"""

from __future__ import annotations

import pytest


@pytest.fixture
def user():
    """Create a regular user."""
    from apps.identity.tests.factories import UserFactory

    return UserFactory()


@pytest.fixture
def staff_user():
    """Create a staff user."""
    from apps.identity.tests.factories import UserFactory

    return UserFactory(is_staff=True)


@pytest.fixture
def admin_user():
    """Create a superuser."""
    from apps.identity.tests.factories import UserFactory

    return UserFactory(is_staff=True, is_superuser=True)


@pytest.fixture
def api_client():
    """Get an unauthenticated API client."""
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def authenticated_client(user):
    """Get an authenticated API client."""
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def staff_client(staff_user):
    """Get a staff API client (staff holds explicit full permission grants)."""
    from rest_framework.test import APIClient

    from apps.organization.tests.rbac_helpers import grant_all_known_codes

    grant_all_known_codes(staff_user)
    client = APIClient()
    client.force_authenticate(user=staff_user)
    return client


@pytest.fixture
def admin_client(admin_user):
    """Get an admin API client."""
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client
