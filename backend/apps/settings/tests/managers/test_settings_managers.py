# tests/managers/test_settings.py
"""
Manager tests for Settings application.
"""

from __future__ import annotations

import pytest

from apps.settings.models.category import SettingCategory
from apps.settings.models.definition import SettingDefinition
from apps.settings.models.feature_flag import FeatureFlag
from apps.settings.models.localization import Localization
from apps.settings.models.organization import OrganizationSetting
from apps.settings.models.system import SystemSetting
from apps.settings.models.theme import Theme
from apps.settings.tests.factories import (
    CategoryFactory,
    DefinitionFactory,
    FeatureFlagFactory,
    LocalizationFactory,
    OrganizationSettingFactory,
    SystemSettingFactory,
    ThemeFactory,
)


class TestThemeManager:
    """Tests for Theme manager."""

    @pytest.mark.django_db
    def test_manager_all(self) -> None:
        """Test manager all method."""
        theme = ThemeFactory()
        queryset = Theme.objects.all()
        assert theme in queryset

    @pytest.mark.django_db
    def test_manager_filter_by_type(self) -> None:
        """Test manager filter by theme_type."""
        theme1 = ThemeFactory(theme_type="light")
        theme2 = ThemeFactory(theme_type="dark")
        queryset = Theme.objects.filter(theme_type="light")
        assert theme1 in queryset
        assert theme2 not in queryset

    @pytest.mark.django_db
    def test_manager_filter_by_organization(self, organization: ThemeFactory) -> None:
        """Test manager filter by organization."""
        theme1 = ThemeFactory(organization=organization)
        theme2 = ThemeFactory()
        queryset = Theme.objects.filter(organization=organization)
        assert theme1 in queryset
        assert theme2 not in queryset


class TestCategoryManager:
    """Tests for SettingCategory manager."""

    @pytest.mark.django_db
    def test_manager_all(self) -> None:
        """Test manager all method."""
        category = CategoryFactory()
        queryset = SettingCategory.objects.all()
        assert category in queryset

    @pytest.mark.django_db
    def test_manager_filter_by_code(self) -> None:
        """Test manager filter by code."""
        category1 = CategoryFactory(code="general")
        category2 = CategoryFactory(code="match")
        queryset = SettingCategory.objects.filter(code="general")
        assert category1 in queryset
        assert category2 not in queryset

    @pytest.mark.django_db
    def test_manager_filter_by_is_active(self) -> None:
        """Test manager filter by is_active."""
        category1 = CategoryFactory(is_active=True)
        category2 = CategoryFactory(is_active=False)
        queryset = SettingCategory.objects.filter(is_active=True)
        assert category1 in queryset
        assert category2 not in queryset


class TestDefinitionManager:
    """Tests for SettingDefinition manager."""

    @pytest.mark.django_db
    def test_manager_all(self) -> None:
        """Test manager all method."""
        definition = DefinitionFactory()
        queryset = SettingDefinition.objects.all()
        assert definition in queryset

    @pytest.mark.django_db
    def test_manager_filter_by_type(self) -> None:
        """Test manager filter by data_type."""
        definition1 = DefinitionFactory(data_type="string")
        definition2 = DefinitionFactory(data_type="integer")
        queryset = SettingDefinition.objects.filter(data_type="string")
        assert definition1 in queryset
        assert definition2 not in queryset

    @pytest.mark.django_db
    def test_manager_filter_by_scope(self) -> None:
        """Test manager filter by scope."""
        definition1 = DefinitionFactory(scope="organization")
        definition2 = DefinitionFactory(scope="system")
        queryset = SettingDefinition.objects.filter(scope="organization")
        assert definition1 in queryset
        assert definition2 not in queryset


class TestFeatureFlagManager:
    """Tests for FeatureFlag manager."""

    @pytest.mark.django_db
    def test_manager_all(self) -> None:
        """Test manager all method."""
        flag = FeatureFlagFactory()
        queryset = FeatureFlag.objects.all()
        assert flag in queryset

    @pytest.mark.django_db
    def test_manager_filter_by_status(self) -> None:
        """Test manager filter by status."""
        flag1 = FeatureFlagFactory(status="enabled")
        flag2 = FeatureFlagFactory(status="disabled")
        queryset = FeatureFlag.objects.filter(status="enabled")
        assert flag1 in queryset
        assert flag2 not in queryset

    @pytest.mark.django_db
    def test_manager_filter_by_is_enabled(self) -> None:
        """Test manager filter by is_enabled."""
        flag1 = FeatureFlagFactory(is_enabled=True)
        flag2 = FeatureFlagFactory(is_enabled=False)
        queryset = FeatureFlag.objects.filter(is_enabled=True)
        assert flag1 in queryset
        assert flag2 not in queryset


class TestLocalizationManager:
    """Tests for Localization manager."""

    @pytest.mark.django_db
    def test_manager_all(self) -> None:
        """Test manager all method."""
        localization = LocalizationFactory()
        queryset = Localization.objects.all()
        assert localization in queryset

    @pytest.mark.django_db
    def test_manager_filter_by_language(self) -> None:
        """Test manager filter by language."""
        localization1 = LocalizationFactory(language="en")
        localization2 = LocalizationFactory(language="hi")
        queryset = Localization.objects.filter(language="en")
        assert localization1 in queryset
        assert localization2 not in queryset

    @pytest.mark.django_db
    def test_manager_filter_by_timezone(self) -> None:
        """Test manager filter by timezone."""
        localization1 = LocalizationFactory(timezone="Asia/Kolkata")
        localization2 = LocalizationFactory(timezone="UTC")
        queryset = Localization.objects.filter(timezone="Asia/Kolkata")
        assert localization1 in queryset
        assert localization2 not in queryset


class TestOrganizationSettingManager:
    """Tests for OrganizationSetting manager."""

    @pytest.mark.django_db
    def test_manager_all(self) -> None:
        """Test manager all method."""
        setting = OrganizationSettingFactory()
        queryset = OrganizationSetting.objects.all()
        assert setting in queryset

    @pytest.mark.django_db
    def test_manager_filter_by_organization(
        self, organization: OrganizationSettingFactory
    ) -> None:
        """Test manager filter by organization."""
        setting1 = OrganizationSettingFactory(organization=organization)
        setting2 = OrganizationSettingFactory()
        queryset = OrganizationSetting.objects.filter(organization=organization)
        assert setting1 in queryset
        assert setting2 not in queryset


class TestSystemSettingManager:
    """Tests for SystemSetting manager."""

    @pytest.mark.django_db
    def test_manager_all(self) -> None:
        """Test manager all method."""
        setting = SystemSettingFactory()
        queryset = SystemSetting.objects.all()
        assert setting in queryset

    @pytest.mark.django_db
    def test_manager_filter_by_locked(self) -> None:
        """Test manager filter by is_locked."""
        setting1 = SystemSettingFactory(is_locked=True)
        setting2 = SystemSettingFactory(is_locked=False)
        queryset = SystemSetting.objects.filter(is_locked=True)
        assert setting1 in queryset
        assert setting2 not in queryset
