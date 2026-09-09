# tests/conftest.py
"""
Pytest configuration for Settings application tests.
"""

from __future__ import annotations

import pytest
from django.test import RequestFactory

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import OrganizationFactory
from apps.settings.tests.factories import (
    CategoryFactory,
    DefinitionFactory,
    FeatureFlagFactory,
    LocalizationFactory,
    OrganizationSettingFactory,
    SystemSettingFactory,
    ThemeFactory,
)


@pytest.fixture
def rf() -> RequestFactory:
    """RequestFactory instance for creating test requests."""
    return RequestFactory()


@pytest.fixture
def user(db):
    """Create a regular user."""
    return UserFactory()


@pytest.fixture
def staff_user(db):
    """Create a staff user."""
    return UserFactory.create(is_staff=True)


@pytest.fixture
def admin_user(db):
    """Create an admin user."""
    return UserFactory.create(is_staff=True, is_superuser=True)


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
    """Get a staff API client."""
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=staff_user)
    return client


@pytest.fixture
def organization() -> OrganizationFactory:
    """Create an organization."""
    return OrganizationFactory()


@pytest.fixture
def theme() -> ThemeFactory:
    """Create a theme instance."""
    return ThemeFactory()


@pytest.fixture
def category() -> CategoryFactory:
    """Create a category instance."""
    return CategoryFactory()


@pytest.fixture
def definition() -> DefinitionFactory:
    """Create a definition instance."""
    return DefinitionFactory()


@pytest.fixture
def feature_flag() -> FeatureFlagFactory:
    """Create a feature flag instance."""
    return FeatureFlagFactory()


@pytest.fixture
def localization() -> LocalizationFactory:
    """Create a localization instance."""
    return LocalizationFactory()


@pytest.fixture
def organization_setting() -> OrganizationSettingFactory:
    """Create an organization setting instance."""
    return OrganizationSettingFactory()


@pytest.fixture
def system_setting() -> SystemSettingFactory:
    """Create a system setting instance."""
    return SystemSettingFactory()
