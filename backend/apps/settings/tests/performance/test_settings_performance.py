# tests/performance/test_settings_performance.py
"""
Performance tests for Settings application queries.
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


class TestThemeQueryPerformance:
    """Tests for Theme query performance."""

    @pytest.mark.django_db
    def test_theme_get_by_uuid_query_count(
        self, django_assert_num_queries, theme: Theme
    ) -> None:
        """Test query count for getting by primary key."""
        with django_assert_num_queries(1):
            Theme.objects.get(id=theme.id)

    @pytest.mark.django_db
    def test_theme_list_query_count(
        self, django_assert_num_queries
    ) -> None:
        """Test query count for listing."""
        ThemeFactory.create_batch(10)
        with django_assert_num_queries(1):
            list(Theme.objects.all())

    @pytest.mark.django_db
    def test_theme_list_with_select_related_query_count(
        self, django_assert_num_queries
    ) -> None:
        """Test query count for listing with select_related."""
        ThemeFactory.create_batch(10)
        with django_assert_num_queries(1):
            list(Theme.objects.select_related("organization"))

    @pytest.mark.django_db
    def test_theme_filter_by_type_query_count(
        self, django_assert_num_queries
    ) -> None:
        """Test query count for filtering by theme_type."""
        ThemeFactory.create_batch(10)
        with django_assert_num_queries(1):
            list(Theme.objects.filter(theme_type="light"))


class TestCategoryQueryPerformance:
    """Tests for Category query performance."""

    @pytest.mark.django_db
    def test_category_get_by_uuid_query_count(
        self, django_assert_num_queries, category: SettingCategory
    ) -> None:
        """Test query count for getting by primary key."""
        with django_assert_num_queries(1):
            SettingCategory.objects.get(id=category.id)

    @pytest.mark.django_db
    def test_category_list_query_count(
        self, django_assert_num_queries
    ) -> None:
        """Test query count for listing."""
        CategoryFactory.create_batch(10)
        with django_assert_num_queries(1):
            list(SettingCategory.objects.all())


class TestDefinitionQueryPerformance:
    """Tests for Definition query performance."""

    @pytest.mark.django_db
    def test_definition_get_by_uuid_query_count(
        self, django_assert_num_queries, definition: SettingDefinition
    ) -> None:
        """Test query count for getting by primary key."""
        with django_assert_num_queries(1):
            SettingDefinition.objects.get(id=definition.id)

    @pytest.mark.django_db
    def test_definition_list_query_count(
        self, django_assert_num_queries
    ) -> None:
        """Test query count for listing."""
        DefinitionFactory.create_batch(10)
        with django_assert_num_queries(1):
            list(SettingDefinition.objects.all())


class TestFeatureFlagQueryPerformance:
    """Tests for FeatureFlag query performance."""

    @pytest.mark.django_db
    def test_feature_flag_get_by_uuid_query_count(
        self, django_assert_num_queries, feature_flag: FeatureFlag
    ) -> None:
        """Test query count for getting by primary key."""
        with django_assert_num_queries(1):
            FeatureFlag.objects.get(id=feature_flag.id)

    @pytest.mark.django_db
    def test_feature_flag_list_query_count(
        self, django_assert_num_queries
    ) -> None:
        """Test query count for listing."""
        FeatureFlagFactory.create_batch(10)
        with django_assert_num_queries(1):
            list(FeatureFlag.objects.all())


class TestLocalizationQueryPerformance:
    """Tests for Localization query performance."""

    @pytest.mark.django_db
    def test_localization_get_by_uuid_query_count(
        self, django_assert_num_queries, localization: Localization
    ) -> None:
        """Test query count for getting by primary key."""
        with django_assert_num_queries(1):
            Localization.objects.get(id=localization.id)

    @pytest.mark.django_db
    def test_localization_list_query_count(
        self, django_assert_num_queries
    ) -> None:
        """Test query count for listing."""
        LocalizationFactory.create_batch(10)
        with django_assert_num_queries(1):
            list(Localization.objects.all())


class TestOrganizationSettingQueryPerformance:
    """Tests for OrganizationSetting query performance."""

    @pytest.mark.django_db
    def test_organization_setting_get_by_uuid_query_count(
        self,
        django_assert_num_queries,
        organization_setting: OrganizationSetting,
    ) -> None:
        """Test query count for getting by primary key."""
        with django_assert_num_queries(1):
            OrganizationSetting.objects.get(id=organization_setting.id)

    @pytest.mark.django_db
    def test_organization_setting_list_query_count(
        self, django_assert_num_queries
    ) -> None:
        """Test query count for listing."""
        OrganizationSettingFactory.create_batch(10)
        with django_assert_num_queries(1):
            list(OrganizationSetting.objects.all())


class TestSystemSettingQueryPerformance:
    """Tests for SystemSetting query performance."""

    @pytest.mark.django_db
    def test_system_setting_get_by_uuid_query_count(
        self, django_assert_num_queries, system_setting: SystemSetting
    ) -> None:
        """Test query count for getting by primary key."""
        with django_assert_num_queries(1):
            SystemSetting.objects.get(id=system_setting.id)

    @pytest.mark.django_db
    def test_system_setting_list_query_count(
        self, django_assert_num_queries
    ) -> None:
        """Test query count for listing."""
        SystemSettingFactory.create_batch(10)
        with django_assert_num_queries(1):
            list(SystemSetting.objects.all())
