# tests/fixtures.py
"""
Test fixtures for Settings application.
"""

from __future__ import annotations

import pytest

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
def theme(db) -> ThemeFactory:
    """Create a theme instance."""
    return ThemeFactory()


@pytest.fixture
def category(db) -> CategoryFactory:
    """Create a category instance."""
    return CategoryFactory()


@pytest.fixture
def definition(db) -> DefinitionFactory:
    """Create a definition instance."""
    return DefinitionFactory()


@pytest.fixture
def feature_flag(db) -> FeatureFlagFactory:
    """Create a feature flag instance."""
    return FeatureFlagFactory()


@pytest.fixture
def localization(db) -> LocalizationFactory:
    """Create a localization instance."""
    return LocalizationFactory()


@pytest.fixture
def organization_setting(db) -> OrganizationSettingFactory:
    """Create an organization setting instance."""
    return OrganizationSettingFactory()


@pytest.fixture
def system_setting(db) -> SystemSettingFactory:
    """Create a system setting instance."""
    return SystemSettingFactory()
