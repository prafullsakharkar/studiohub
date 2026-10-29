# tests/querysets/test_settings.py
"""
QuerySet tests for Settings application.
"""

from __future__ import annotations

import pytest

from apps.settings.models.category import SettingCategory
from apps.settings.models.definition import SettingDefinition
from apps.settings.models.feature_flag import FeatureFlag
from apps.settings.models.localization import Localization
from apps.settings.models.system import SystemSetting
from apps.settings.models.theme import Theme
from apps.settings.tests.factories import (
    CategoryFactory,
    DefinitionFactory,
    FeatureFlagFactory,
    LocalizationFactory,
    SystemSettingFactory,
    ThemeFactory,
)


class TestThemeQuerySet:
    """Tests for Theme queryset."""

    @pytest.mark.django_db
    def test_queryset_filter_by_type(self) -> None:
        """Test filtering by theme_type."""
        theme1 = ThemeFactory(theme_type="light")
        theme2 = ThemeFactory(theme_type="dark")
        queryset = Theme.objects.filter(theme_type="light")
        assert theme1 in queryset
        assert theme2 not in queryset

    @pytest.mark.django_db
    def test_queryset_all(self) -> None:
        """Test plain queryset over themes."""
        theme = ThemeFactory()
        queryset = Theme.objects.all()
        assert theme in queryset


class TestCategoryQuerySet:
    """Tests for SettingCategory queryset."""

    @pytest.mark.django_db
    def test_queryset_filter_by_code(self) -> None:
        """Test filtering by code."""
        category1 = CategoryFactory(code="general")
        category2 = CategoryFactory(code="project")
        queryset = SettingCategory.objects.filter(code="general")
        assert category1 in queryset
        assert category2 not in queryset

    @pytest.mark.django_db
    def test_queryset_filter_by_is_active(self) -> None:
        """Test filtering by is_active."""
        category1 = CategoryFactory(is_active=True)
        category2 = CategoryFactory(is_active=False)
        queryset = SettingCategory.objects.filter(is_active=True)
        assert category1 in queryset
        assert category2 not in queryset


class TestDefinitionQuerySet:
    """Tests for SettingDefinition queryset."""

    @pytest.mark.django_db
    def test_queryset_filter_by_type(self) -> None:
        """Test filtering by data_type."""
        definition1 = DefinitionFactory(data_type="string")
        definition2 = DefinitionFactory(data_type="integer")
        queryset = SettingDefinition.objects.filter(data_type="string")
        assert definition1 in queryset
        assert definition2 not in queryset

    @pytest.mark.django_db
    def test_queryset_filter_by_scope(self) -> None:
        """Test filtering by scope (system-wide only)."""
        definition1 = DefinitionFactory(scope="system")
        definition2 = DefinitionFactory(scope="system")
        queryset = SettingDefinition.objects.filter(scope="system")
        assert definition1 in queryset
        assert definition2 in queryset


class TestFeatureFlagQuerySet:
    """Tests for FeatureFlag queryset."""

    @pytest.mark.django_db
    def test_queryset_filter_by_status(self) -> None:
        """Test filtering by status."""
        flag1 = FeatureFlagFactory(status="enabled")
        flag2 = FeatureFlagFactory(status="disabled")
        queryset = FeatureFlag.objects.filter(status="enabled")
        assert flag1 in queryset
        assert flag2 not in queryset

    @pytest.mark.django_db
    def test_queryset_filter_by_is_enabled(self) -> None:
        """Test filtering by is_enabled."""
        flag1 = FeatureFlagFactory(is_enabled=True)
        flag2 = FeatureFlagFactory(is_enabled=False)
        queryset = FeatureFlag.objects.filter(is_enabled=True)
        assert flag1 in queryset
        assert flag2 not in queryset


class TestLocalizationQuerySet:
    """Tests for Localization queryset."""

    @pytest.mark.django_db
    def test_queryset_filter_by_language(self) -> None:
        """Test filtering by language."""
        localization1 = LocalizationFactory(language="en")
        localization2 = LocalizationFactory(language="hi")
        queryset = Localization.objects.filter(language="en")
        assert localization1 in queryset
        assert localization2 not in queryset

    @pytest.mark.django_db
    def test_queryset_filter_by_timezone(self) -> None:
        """Test filtering by timezone."""
        localization1 = LocalizationFactory(timezone="Asia/Kolkata")
        localization2 = LocalizationFactory(timezone="UTC")
        queryset = Localization.objects.filter(timezone="Asia/Kolkata")
        assert localization1 in queryset
        assert localization2 not in queryset


class TestSystemSettingQuerySet:
    """Tests for SystemSetting queryset."""

    @pytest.mark.django_db
    def test_queryset_filter_by_locked(self) -> None:
        """Test filtering by is_locked."""
        setting1 = SystemSettingFactory(is_locked=True)
        setting2 = SystemSettingFactory(is_locked=False)
        queryset = SystemSetting.objects.filter(is_locked=True)
        assert setting1 in queryset
        assert setting2 not in queryset
