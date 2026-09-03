# tests/models/test_settings.py
"""
Model tests for Settings application.
"""

from __future__ import annotations

import pytest
from django.db import IntegrityError

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
    ThemeFactory,
)


class TestThemeModel:
    """Tests for Theme model."""

    @pytest.mark.django_db
    def test_create_theme(self, theme: Theme) -> None:
        """Test creating a theme instance."""
        assert theme.uuid is not None
        assert theme.name is not None
        assert theme.code is not None

    @pytest.mark.django_db
    def test_theme_str_method(self, theme: Theme) -> None:
        """Test __str__ method."""
        assert str(theme) == theme.name

    @pytest.mark.django_db
    def test_theme_audit_fields(self, theme: Theme) -> None:
        """Test audit fields are present."""
        assert theme.created_at is not None
        assert theme.updated_at is not None

    @pytest.mark.django_db
    def test_theme_soft_delete(self, theme: Theme) -> None:
        """Test soft delete functionality."""
        assert theme.deleted_at is None
        theme.soft_delete()
        theme.refresh_from_db()
        assert theme.deleted_at is not None

    @pytest.mark.django_db
    def test_theme_theme_type_choices(self, theme: Theme) -> None:
        """Test theme_type field choices."""
        valid_choices = ["light", "dark", "custom"]
        assert theme.theme_type in valid_choices

    @pytest.mark.django_db
    def test_theme_organization_unique_together(self) -> None:
        """Test organization + code unique constraint."""
        org = ThemeFactory()
        with pytest.raises(IntegrityError):
            ThemeFactory(code=org.code, organization=org.organization)


class TestCategoryModel:
    """Tests for SettingCategory model."""

    @pytest.mark.django_db
    def test_create_category(self, category: SettingCategory) -> None:
        """Test creating a category instance."""
        assert category.uuid is not None
        assert category.name is not None
        assert category.code is not None

    @pytest.mark.django_db
    def test_category_str_method(self, category: SettingCategory) -> None:
        """Test __str__ method."""
        assert str(category) == category.name

    @pytest.mark.django_db
    def test_category_audit_fields(self, category: SettingCategory) -> None:
        """Test audit fields are present."""
        assert category.created_at is not None
        assert category.updated_at is not None

    @pytest.mark.django_db
    def test_category_soft_delete(self, category: SettingCategory) -> None:
        """Test soft delete functionality."""
        assert category.deleted_at is None
        category.soft_delete()
        category.refresh_from_db()
        assert category.deleted_at is not None

    @pytest.mark.django_db
    def test_category_code_choices(self) -> None:
        """Test code field choices."""
        valid_codes = [cat[0] for cat in SettingCategory.CATEGORY_CHOICES]
        category = CategoryFactory()
        assert category.code in valid_codes


class TestDefinitionModel:
    """Tests for SettingDefinition model."""

    @pytest.mark.django_db
    def test_create_definition(self, definition: SettingDefinition) -> None:
        """Test creating a definition instance."""
        assert definition.uuid is not None
        assert definition.name is not None
        assert definition.code is not None

    @pytest.mark.django_db
    def test_definition_str_method(self, definition: SettingDefinition) -> None:
        """Test __str__ method."""
        assert str(definition) == definition.name

    @pytest.mark.django_db
    def test_definition_audit_fields(self, definition: SettingDefinition) -> None:
        """Test audit fields are present."""
        assert definition.created_at is not None
        assert definition.updated_at is not None

    @pytest.mark.django_db
    def test_definition_soft_delete(self, definition: SettingDefinition) -> None:
        """Test soft delete functionality."""
        assert definition.deleted_at is None
        definition.soft_delete()
        definition.refresh_from_db()
        assert definition.deleted_at is not None

    @pytest.mark.django_db
    def test_definition_type_choices(self) -> None:
        """Test data_type field choices."""
        valid_types = [t[0] for t in SettingDefinition.TYPE_CHOICES]
        definition = DefinitionFactory()
        assert definition.data_type in valid_types

    @pytest.mark.django_db
    def test_definition_scope_choices(self) -> None:
        """Test scope field choices."""
        valid_scopes = [s[0] for s in SettingDefinition.SCOPE_CHOICES]
        definition = DefinitionFactory()
        assert definition.scope in valid_scopes


class TestFeatureFlagModel:
    """Tests for FeatureFlag model."""

    @pytest.mark.django_db
    def test_create_feature_flag(self, feature_flag: FeatureFlag) -> None:
        """Test creating a feature flag instance."""
        assert feature_flag.uuid is not None
        assert feature_flag.name is not None
        assert feature_flag.code is not None

    @pytest.mark.django_db
    def test_feature_flag_str_method(self, feature_flag: FeatureFlag) -> None:
        """Test __str__ method."""
        assert str(feature_flag) == feature_flag.name

    @pytest.mark.django_db
    def test_feature_flag_audit_fields(self, feature_flag: FeatureFlag) -> None:
        """Test audit fields are present."""
        assert feature_flag.created_at is not None
        assert feature_flag.updated_at is not None

    @pytest.mark.django_db
    def test_feature_flag_soft_delete(self, feature_flag: FeatureFlag) -> None:
        """Test soft delete functionality."""
        assert feature_flag.deleted_at is None
        feature_flag.soft_delete()
        feature_flag.refresh_from_db()
        assert feature_flag.deleted_at is not None

    @pytest.mark.django_db
    def test_feature_flag_type_choices(self) -> None:
        """Test feature_type field choices."""
        valid_types = ["boolean", "percentage", "scheduled", "rollout"]
        feature_flag = FeatureFlagFactory()
        assert feature_flag.feature_type in valid_types

    @pytest.mark.django_db
    def test_feature_flag_status_choices(self) -> None:
        """Test status field choices."""
        valid_statuses = ["enabled", "disabled", "scheduled", "expired"]
        feature_flag = FeatureFlagFactory()
        assert feature_flag.status in valid_statuses


class TestLocalizationModel:
    """Tests for Localization model."""

    @pytest.mark.django_db
    def test_create_localization(self, localization: Localization) -> None:
        """Test creating a localization instance."""
        assert localization.uuid is not None
        assert localization.name is not None
        assert localization.code is not None

    @pytest.mark.django_db
    def test_localization_str_method(self, localization: Localization) -> None:
        """Test __str__ method."""
        assert str(localization) == localization.name

    @pytest.mark.django_db
    def test_localization_audit_fields(self, localization: Localization) -> None:
        """Test audit fields are present."""
        assert localization.created_at is not None
        assert localization.updated_at is not None

    @pytest.mark.django_db
    def test_localization_soft_delete(self, localization: Localization) -> None:
        """Test soft delete functionality."""
        assert localization.deleted_at is None
        localization.soft_delete()
        localization.refresh_from_db()
        assert localization.deleted_at is not None

    @pytest.mark.django_db
    def test_localization_language_choices(self) -> None:
        """Test language field choices."""
        valid_languages = [l[0] for l in Localization.LANGUAGE_CHOICES]
        localization = LocalizationFactory()
        assert localization.language in valid_languages

    @pytest.mark.django_db
    def test_localization_timezone_choices(self) -> None:
        """Test timezone field choices."""
        valid_timezones = [t[0] for t in Localization.TIMEZONE_CHOICES]
        localization = LocalizationFactory()
        assert localization.timezone in valid_timezones


class TestOrganizationSettingModel:
    """Tests for OrganizationSetting model."""

    @pytest.mark.django_db
    def test_create_organization_setting(
        self, organization_setting: OrganizationSetting
    ) -> None:
        """Test creating an organization setting instance."""
        assert organization_setting.uuid is not None
        assert organization_setting.value is not None

    @pytest.mark.django_db
    def test_organization_setting_str_method(
        self, organization_setting: OrganizationSetting
    ) -> None:
        """Test __str__ method."""
        expected = (
            f"{organization_setting.organization.name}: {organization_setting.setting.name}"
        )
        assert str(organization_setting) == expected

    @pytest.mark.django_db
    def test_organization_setting_audit_fields(
        self, organization_setting: OrganizationSetting
    ) -> None:
        """Test audit fields are present."""
        assert organization_setting.created_at is not None
        assert organization_setting.updated_at is not None

    @pytest.mark.django_db
    def test_organization_setting_soft_delete(
        self, organization_setting: OrganizationSetting
    ) -> None:
        """Test soft delete functionality."""
        assert organization_setting.deleted_at is None
        organization_setting.soft_delete()
        organization_setting.refresh_from_db()
        assert organization_setting.deleted_at is not None

    @pytest.mark.django_db
    def test_organization_setting_value_parsed(
        self, organization_setting: OrganizationSetting
    ) -> None:
        """Test value_parsed property."""
        organization_setting.value = '{"key": "value"}'
        assert organization_setting.value_parsed == {"key": "value"}

    @pytest.mark.django_db
    def test_organization_setting_set_value(
        self, organization_setting: OrganizationSetting
    ) -> None:
        """Test set_value method."""
        organization_setting.set_value({"key": "value"})
        assert organization_setting.value == '{"key": "value"}'


class TestSystemSettingModel:
    """Tests for SystemSetting model."""

    @pytest.mark.django_db
    def test_create_system_setting(self, system_setting: SystemSetting) -> None:
        """Test creating a system setting instance."""
        assert system_setting.uuid is not None
        assert system_setting.value is not None

    @pytest.mark.django_db
    def test_system_setting_str_method(self, system_setting: SystemSetting) -> None:
        """Test __str__ method."""
        expected = f"System: {system_setting.setting.name}"
        assert str(system_setting) == expected

    @pytest.mark.django_db
    def test_system_setting_audit_fields(self, system_setting: SystemSetting) -> None:
        """Test audit fields are present."""
        assert system_setting.created_at is not None
        assert system_setting.updated_at is not None

    @pytest.mark.django_db
    def test_system_setting_soft_delete(self, system_setting: SystemSetting) -> None:
        """Test soft delete functionality."""
        assert system_setting.deleted_at is None
        system_setting.soft_delete()
        system_setting.refresh_from_db()
        assert system_setting.deleted_at is not None

    @pytest.mark.django_db
    def test_system_setting_value_parsed(self, system_setting: SystemSetting) -> None:
        """Test value_parsed property."""
        system_setting.value = '{"key": "value"}'
        assert system_setting.value_parsed == {"key": "value"}

    @pytest.mark.django_db
    def test_system_setting_set_value(self, system_setting: SystemSetting) -> None:
        """Test set_value method."""
        system_setting.set_value({"key": "value"})
        assert system_setting.value == '{"key": "value"}'
