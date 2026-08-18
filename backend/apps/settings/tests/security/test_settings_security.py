# tests/security/test_settings_security.py
"""
Security tests for Settings application.
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


def _assert_soft_delete(obj) -> None:
    """Soft-delete an object and verify the soft-delete contract."""
    obj_id = obj.id
    obj.soft_delete()
    obj.refresh_from_db()
    assert obj.is_deleted is True
    assert obj.deleted_at is not None
    # Default manager excludes soft-deleted rows.
    assert obj.__class__.objects.filter(id=obj_id).count() == 0
    # all_objects manager still sees it.
    assert obj.__class__.all_objects.filter(id=obj_id).count() == 1


class TestThemeSecurity:
    """Security tests for Theme model."""

    @pytest.mark.django_db
    def test_theme_uuid_is_unique(self) -> None:
        """Test UUID field is unique."""
        theme1 = ThemeFactory()
        theme2 = ThemeFactory()
        assert theme1.uuid != theme2.uuid

    @pytest.mark.django_db
    def test_theme_audit_fields(self, theme: Theme) -> None:
        """Test audit fields are present and nullable."""
        assert theme.created_at is not None
        assert theme.updated_at is not None
        assert theme.created_by is None
        assert theme.updated_by is None

    @pytest.mark.django_db
    def test_theme_soft_delete(self, theme: Theme) -> None:
        """Test soft delete functionality."""
        _assert_soft_delete(theme)

    @pytest.mark.django_db
    def test_theme_timestamps(self, theme: Theme) -> None:
        """Test timestamps are set correctly."""
        assert theme.created_at is not None
        assert theme.updated_at is not None

    @pytest.mark.django_db
    def test_theme_restore(self, theme: Theme) -> None:
        """Test restore after soft delete."""
        theme.soft_delete()
        theme.refresh_from_db()
        theme.restore()
        theme.refresh_from_db()
        assert theme.is_deleted is False
        assert theme.deleted_at is None


class TestCategorySecurity:
    """Security tests for Category model."""

    @pytest.mark.django_db
    def test_category_uuid_is_unique(self) -> None:
        """Test UUID field is unique."""
        category1 = CategoryFactory()
        category2 = CategoryFactory()
        assert category1.uuid != category2.uuid

    @pytest.mark.django_db
    def test_category_audit_fields(self, category: SettingCategory) -> None:
        """Test audit fields are present and nullable."""
        assert category.created_at is not None
        assert category.updated_at is not None
        assert category.created_by is None
        assert category.updated_by is None

    @pytest.mark.django_db
    def test_category_soft_delete(self, category: SettingCategory) -> None:
        """Test soft delete functionality."""
        _assert_soft_delete(category)


class TestDefinitionSecurity:
    """Security tests for Definition model."""

    @pytest.mark.django_db
    def test_definition_uuid_is_unique(self) -> None:
        """Test UUID field is unique."""
        definition1 = DefinitionFactory()
        definition2 = DefinitionFactory()
        assert definition1.uuid != definition2.uuid

    @pytest.mark.django_db
    def test_definition_audit_fields(self, definition: SettingDefinition) -> None:
        """Test audit fields are present and nullable."""
        assert definition.created_at is not None
        assert definition.updated_at is not None
        assert definition.created_by is None
        assert definition.updated_by is None

    @pytest.mark.django_db
    def test_definition_soft_delete(self, definition: SettingDefinition) -> None:
        """Test soft delete functionality."""
        _assert_soft_delete(definition)


class TestFeatureFlagSecurity:
    """Security tests for FeatureFlag model."""

    @pytest.mark.django_db
    def test_feature_flag_uuid_is_unique(self) -> None:
        """Test UUID field is unique."""
        flag1 = FeatureFlagFactory()
        flag2 = FeatureFlagFactory()
        assert flag1.uuid != flag2.uuid

    @pytest.mark.django_db
    def test_feature_flag_audit_fields(self, feature_flag: FeatureFlag) -> None:
        """Test audit fields are present and nullable."""
        assert feature_flag.created_at is not None
        assert feature_flag.updated_at is not None
        assert feature_flag.created_by is None
        assert feature_flag.updated_by is None

    @pytest.mark.django_db
    def test_feature_flag_soft_delete(self, feature_flag: FeatureFlag) -> None:
        """Test soft delete functionality."""
        _assert_soft_delete(feature_flag)


class TestLocalizationSecurity:
    """Security tests for Localization model."""

    @pytest.mark.django_db
    def test_localization_uuid_is_unique(self) -> None:
        """Test UUID field is unique."""
        localization1 = LocalizationFactory()
        localization2 = LocalizationFactory()
        assert localization1.uuid != localization2.uuid

    @pytest.mark.django_db
    def test_localization_audit_fields(self, localization: Localization) -> None:
        """Test audit fields are present and nullable."""
        assert localization.created_at is not None
        assert localization.updated_at is not None
        assert localization.created_by is None
        assert localization.updated_by is None

    @pytest.mark.django_db
    def test_localization_soft_delete(self, localization: Localization) -> None:
        """Test soft delete functionality."""
        _assert_soft_delete(localization)


class TestOrganizationSettingSecurity:
    """Security tests for OrganizationSetting model."""

    @pytest.mark.django_db
    def test_organization_setting_uuid_is_unique(self) -> None:
        """Test UUID field is unique."""
        setting1 = OrganizationSettingFactory()
        setting2 = OrganizationSettingFactory()
        assert setting1.uuid != setting2.uuid

    @pytest.mark.django_db
    def test_organization_setting_audit_fields(
        self, organization_setting: OrganizationSetting
    ) -> None:
        """Test audit fields are present and nullable."""
        assert organization_setting.created_at is not None
        assert organization_setting.updated_at is not None
        assert organization_setting.created_by is None
        assert organization_setting.updated_by is None

    @pytest.mark.django_db
    def test_organization_setting_soft_delete(
        self, organization_setting: OrganizationSetting
    ) -> None:
        """Test soft delete functionality."""
        _assert_soft_delete(organization_setting)


class TestSystemSettingSecurity:
    """Security tests for SystemSetting model."""

    @pytest.mark.django_db
    def test_system_setting_uuid_is_unique(self) -> None:
        """Test UUID field is unique."""
        setting1 = SystemSettingFactory()
        setting2 = SystemSettingFactory()
        assert setting1.uuid != setting2.uuid

    @pytest.mark.django_db
    def test_system_setting_audit_fields(self, system_setting: SystemSetting) -> None:
        """Test audit fields are present and nullable."""
        assert system_setting.created_at is not None
        assert system_setting.updated_at is not None
        assert system_setting.created_by is None
        assert system_setting.updated_by is None

    @pytest.mark.django_db
    def test_system_setting_soft_delete(self, system_setting: SystemSetting) -> None:
        """Test soft delete functionality."""
        _assert_soft_delete(system_setting)
