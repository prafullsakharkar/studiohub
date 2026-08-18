# tests/conftest.py
"""
Pytest configuration for Audit application tests.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import OrganizationFactory

from .fixtures import *  # noqa: F401, F403


@pytest.fixture
def user(db):
    """Create a regular user."""
    return UserFactory()


@pytest.fixture
def staff_user(db):
    """Create a staff user."""
    return UserFactory(is_staff=True)


@pytest.fixture
def admin_user(db):
    """Create an admin user."""
    return UserFactory(is_staff=True, is_superuser=True)


@pytest.fixture
def api_client() -> APIClient:
    """API client fixture."""
    return APIClient()


@pytest.fixture
def authenticated_client(api_client: APIClient) -> APIClient:
    """Authenticated API client fixture."""
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def staff_client(api_client: APIClient) -> APIClient:
    """Staff user authenticated API client fixture."""
    user = UserFactory(is_staff=True)
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def admin_client(api_client: APIClient) -> APIClient:
    """Admin user authenticated API client fixture."""
    user = UserFactory(is_superuser=True, is_staff=True)
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def organization(db) -> OrganizationFactory:
    """Organization fixture."""
    return OrganizationFactory()
