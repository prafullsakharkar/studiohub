"""
Filter tests for Settings application.

These test the canonical filter classes (``apps.settings.filters.*``) that the
settings viewsets actually wire into their querysets.
"""

from __future__ import annotations

import pytest

from apps.organization.tests.factories import OrganizationFactory
from apps.settings.filters.category import SettingCategoryFilter
from apps.settings.filters.definition import SettingDefinitionFilter
from apps.settings.filters.feature_flag import FeatureFlagFilter
from apps.settings.filters.localization import LocalizationFilter
from apps.settings.filters.organization import OrganizationSettingFilter
from apps.settings.filters.system import SystemSettingFilter
from apps.settings.filters.theme import ThemeFilter
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


class TestThemeFilter:
    """Tests for ThemeFilter."""

    @pytest.mark.django_db
    def test_filter_by_code_exact(self) -> None:
        """Filter themes by exact code."""
        theme1 = ThemeFactory(code="theme_filter_001")
        theme2 = ThemeFactory(code="theme_filter_002")
        filterset = ThemeFilter(
            Theme.objects.all(),
            data={"code": "theme_filter_001"},
        )
        assert theme1 in filterset.qs
        assert theme2 not in filterset.qs

    @pytest.mark.django_db
    def test_filter_by_code_icontains(self) -> None:
        """Filter themes by partial code."""
        theme1 = ThemeFactory(code="theme_filter_abc")
        theme2 = ThemeFactory(code="other_abc")
        filterset = ThemeFilter(
            Theme.objects.all(),
            data={"code__icontains": "theme_filter"},
        )
        assert theme1 in filterset.qs
        assert theme2 not in filterset.qs

    @pytest.mark.django_db
    def test_filter_by_theme_type(self) -> None:
        """Filter themes by type."""
        from apps.settings.choices.theme import ThemeType

        theme1 = ThemeFactory(theme_type=ThemeType.LIGHT)
        theme2 = ThemeFactory(theme_type=ThemeType.DARK)
        filterset = ThemeFilter(
            Theme.objects.all(),
            data={"theme_type": ThemeType.LIGHT},
        )
        assert theme1 in filterset.qs
        assert theme2 not in filterset.qs

    @pytest.mark.django_db
    def test_filter_by_is_active(self) -> None:
        """Filter themes by active flag."""
        active = ThemeFactory(is_active=True)
        inactive = ThemeFactory(is_active=False)
        filterset = ThemeFilter(
            Theme.objects.all(),
            data={"is_active": "true"},
        )
        assert active in filterset.qs
        assert inactive not in filterset.qs

    @pytest.mark.django_db
    def test_filter_by_organization(self) -> None:
        """Filter themes by organization."""
        org1 = OrganizationFactory()
        org2 = OrganizationFactory()
        theme1 = ThemeFactory(organization=org1)
        ThemeFactory(organization=org2)
        filterset = ThemeFilter(
            Theme.objects.all(),
            data={"organization": str(org1.id)},
        )
        assert theme1 in filterset.qs
        assert filterset.qs.count() == 1

    @pytest.mark.django_db
    def test_empty_data_returns_all(self) -> None:
        """Empty query params return the full queryset."""
        ThemeFactory()
        ThemeFactory()
        filterset = ThemeFilter(Theme.objects.all(), data={})
        assert filterset.qs.count() == Theme.objects.count()


class TestSettingCategoryFilter:
    """Tests for SettingCategoryFilter."""

    @pytest.mark.django_db
    def test_filter_by_code(self) -> None:
        """Filter categories by code."""
        cat1 = CategoryFactory(code=SettingCategory.GENERAL)
        cat2 = CategoryFactory(code=SettingCategory.THEME)
        filterset = SettingCategoryFilter(
            SettingCategory.objects.all(),
            data={"code": SettingCategory.GENERAL},
        )
        assert cat1 in filterset.qs
        assert cat2 not in filterset.qs

    @pytest.mark.django_db
    def test_filter_by_is_active(self) -> None:
        """Filter categories by active flag."""
        active = CategoryFactory(is_active=True)
        inactive = CategoryFactory(is_active=False)
        filterset = SettingCategoryFilter(
            SettingCategory.objects.all(),
            data={"is_active": "true"},
        )
        assert active in filterset.qs
        assert inactive not in filterset.qs


class TestSettingDefinitionFilter:
    """Tests for SettingDefinitionFilter."""

    @pytest.mark.django_db
    def test_filter_by_data_type(self) -> None:
        """Filter definitions by data type."""
        definition1 = DefinitionFactory(data_type="string")
        definition2 = DefinitionFactory(data_type="integer")
        filterset = SettingDefinitionFilter(
            SettingDefinition.objects.all(),
            data={"data_type": "string"},
        )
        assert definition1 in filterset.qs
        assert definition2 not in filterset.qs

    @pytest.mark.django_db
    def test_filter_by_category(self) -> None:
        """Filter definitions by category."""
        definition1 = DefinitionFactory()
        definition2 = DefinitionFactory()
        filterset = SettingDefinitionFilter(
            SettingDefinition.objects.all(),
            data={"category": str(definition1.category_id)},
        )
        assert definition1 in filterset.qs
        assert definition2 not in filterset.qs

    @pytest.mark.django_db
    def test_filter_by_is_required(self) -> None:
        """Filter definitions by required flag."""
        required = DefinitionFactory(is_required=True)
        optional = DefinitionFactory(is_required=False)
        filterset = SettingDefinitionFilter(
            SettingDefinition.objects.all(),
            data={"is_required": "true"},
        )
        assert required in filterset.qs
        assert optional not in filterset.qs


class TestFeatureFlagFilter:
    """Tests for FeatureFlagFilter."""

    @pytest.mark.django_db
    def test_filter_by_status(self) -> None:
        """Filter feature flags by status."""
        from apps.settings.choices.feature_flag import FeatureFlagStatus

        flag1 = FeatureFlagFactory(status=FeatureFlagStatus.ENABLED)
        flag2 = FeatureFlagFactory(status=FeatureFlagStatus.DISABLED)
        filterset = FeatureFlagFilter(
            FeatureFlag.objects.all(),
            data={"status": FeatureFlagStatus.ENABLED},
        )
        assert flag1 in filterset.qs
        assert flag2 not in filterset.qs

    @pytest.mark.django_db
    def test_filter_by_feature_type(self) -> None:
        """Filter feature flags by type."""
        from apps.settings.choices.feature_flag import FeatureFlagType

        flag1 = FeatureFlagFactory(feature_type=FeatureFlagType.BOOLEAN)
        flag2 = FeatureFlagFactory(feature_type=FeatureFlagType.PERCENTAGE)
        filterset = FeatureFlagFilter(
            FeatureFlag.objects.all(),
            data={"feature_type": FeatureFlagType.BOOLEAN},
        )
        assert flag1 in filterset.qs
        assert flag2 not in filterset.qs


class TestLocalizationFilter:
    """Tests for LocalizationFilter."""

    @pytest.mark.django_db
    def test_filter_by_language(self) -> None:
        """Filter localizations by language."""
        loc1 = LocalizationFactory(language="en")
        loc2 = LocalizationFactory(language="hi")
        filterset = LocalizationFilter(
            Localization.objects.all(),
            data={"language": "en"},
        )
        assert loc1 in filterset.qs
        assert loc2 not in filterset.qs

    @pytest.mark.django_db
    def test_filter_by_timezone(self) -> None:
        """Filter localizations by timezone."""
        loc1 = LocalizationFactory(timezone="UTC")
        loc2 = LocalizationFactory(timezone="Asia/Kolkata")
        filterset = LocalizationFilter(
            Localization.objects.all(),
            data={"timezone": "UTC"},
        )
        assert loc1 in filterset.qs
        assert loc2 not in filterset.qs


class TestOrganizationSettingFilter:
    """Tests for OrganizationSettingFilter."""

    @pytest.mark.django_db
    def test_filter_by_is_locked(self) -> None:
        """Filter organization settings by locked flag."""
        locked = OrganizationSettingFactory(is_locked=True)
        unlocked = OrganizationSettingFactory(is_locked=False)
        filterset = OrganizationSettingFilter(
            OrganizationSetting.objects.all(),
            data={"is_locked": "true"},
        )
        assert locked in filterset.qs
        assert unlocked not in filterset.qs


class TestSystemSettingFilter:
    """Tests for SystemSettingFilter."""

    @pytest.mark.django_db
    def test_filter_by_setting(self) -> None:
        """Filter system settings by setting definition."""
        setting1 = SystemSettingFactory()
        setting2 = SystemSettingFactory()
        filterset = SystemSettingFilter(
            SystemSetting.objects.all(),
            data={"setting": str(setting1.setting_id)},
        )
        assert setting1 in filterset.qs
        assert setting2 not in filterset.qs
