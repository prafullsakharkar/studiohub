"""
Intelligence test fixtures.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import UserFactory


@pytest.fixture
def user(db):
    """Create a user."""
    return UserFactory.create()


@pytest.fixture
def staff_user(db):
    """Create a staff user."""
    return UserFactory.create(is_staff=True)


@pytest.fixture
def api_client():
    """Get an unauthenticated API client."""
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def staff_client(staff_user):
    """Get a staff API client."""
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=staff_user)
    return client
