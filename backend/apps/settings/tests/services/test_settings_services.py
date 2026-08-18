# tests/services/test_settings_services.py
"""
Service tests for Settings application.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta

import pytest
from django.core.exceptions import PermissionDenied
from django.utils import timezone

from apps.settings.models.category import SettingCategory
from apps.settings.models.definition import SettingDefinition
from apps.settings.models.feature_flag import FeatureFlag
from apps.settings.models.localization import Localization
from apps.settings.models.organization import OrganizationSetting
from apps.settings.models.system import SystemSetting
from apps.settings.models.theme import Theme
from apps.settings.services.base import SettingsBaseService
from apps.settings.services.category import SettingCategoryService
from apps.settings.services.definition import SettingDefinitionService
from apps.settings.services.feature_flag import FeatureFlagService
from apps.settings.services.localization import LocalizationService
from apps.settings.services.organization import OrganizationSettingService
from apps.settings.services.system import SystemSettingService
from apps.settings.services.theme import ThemeService


class TestSettingsBaseService:
    """Tests for SettingsBaseService."""

    def test_service_validate_is_noop(self) -> None:
        """Base validate hook is a no-op."""
        assert SettingsBaseService.validate(name="Test") is None


class TestThemeService:
    """Tests for ThemeService."""

    @pytest.mark.django_db
    def test_create_theme(self) -> None:
        """Create a theme through the service."""
        theme = ThemeService.create_theme(
            code="theme_create_test",
            name="Test Theme",
            theme_type=Theme.TYPE_LIGHT,
        )
        assert theme.uuid is not None
        assert theme.name == "Test Theme"
        assert theme.code == "theme_create_test"

    @pytest.mark.django_db
    def test_update_theme(self, theme: Theme) -> None:
        """Update a theme through the service."""
        updated = ThemeService.update_theme(theme, name="Updated Theme")
        assert updated.name == "Updated Theme"

    @pytest.mark.django_db
    def test_delete_theme(self, theme: Theme) -> None:
        """Delete a theme through the service."""
        ThemeService.delete_theme(theme)
        assert Theme.objects.filter(id=theme.id).count() == 0

    @pytest.mark.django_db
    def test_activate_theme(self, theme: Theme) -> None:
        """Activate a theme."""
        theme.is_active = False
        theme.save()
        result = ThemeService.activate_theme(theme)
        assert result.is_active is True

    @pytest.mark.django_db
    def test_deactivate_theme(self, theme: Theme) -> None:
        """Deactivate a theme."""
        result = ThemeService.deactivate_theme(theme)
        assert result.is_active is False


class TestSettingCategoryService:
    """Tests for SettingCategoryService."""

    @pytest.mark.django_db
    def test_create_category(self) -> None:
        """Create a category through the service."""
        category = SettingCategoryService.create_category(
            code=SettingCategory.GENERAL,
            name="General",
        )
        assert category.uuid is not None
        assert category.name == "General"
        assert category.code == SettingCategory.GENERAL

    @pytest.mark.django_db
    def test_update_category(self, category: SettingCategory) -> None:
        """Update a category through the service."""
        updated = SettingCategoryService.update_category(
            category, name="Updated Category"
        )
        assert updated.name == "Updated Category"

    @pytest.mark.django_db
    def test_delete_category(self, category: SettingCategory) -> None:
        """Delete a category through the service."""
        SettingCategoryService.delete_category(category)
        assert SettingCategory.objects.filter(id=category.id).count() == 0

    @pytest.mark.django_db
    def test_archive_category(self, category: SettingCategory) -> None:
        """Archive a category."""
        category.is_active = True
        category.save()
        result = SettingCategoryService.archive_category(category)
        assert result.is_active is False

    @pytest.mark.django_db
    def test_restore_category(self, category: SettingCategory) -> None:
        """Restore a category."""
        category.is_active = False
        category.save()
        result = SettingCategoryService.restore_category(category)
        assert result.is_active is True


class TestSettingDefinitionService:
    """Tests for SettingDefinitionService."""

    @pytest.mark.django_db
    def test_create_definition(self, category: SettingCategory) -> None:
        """Create a definition through the service."""
        definition = SettingDefinitionService.create_definition(
            code="svc.definition",
            name="Service Definition",
            category=category,
            data_type=SettingDefinition.TYPE_STRING,
        )
        assert definition.uuid is not None
        assert definition.name == "Service Definition"
        assert definition.category_id == category.id

    @pytest.mark.django_db
    def test_update_definition(self, definition: SettingDefinition) -> None:
        """Update a definition through the service."""
        updated = SettingDefinitionService.update_definition(
            definition, name="Updated Definition"
        )
        assert updated.name == "Updated Definition"

    @pytest.mark.django_db
    def test_delete_definition(self, definition: SettingDefinition) -> None:
        """Delete a definition through the service."""
        SettingDefinitionService.delete_definition(definition)
        assert SettingDefinition.objects.filter(id=definition.id).count() == 0

    @pytest.mark.django_db
    def test_archive_definition(self, definition: SettingDefinition) -> None:
        """Archive a definition."""
        result = SettingDefinitionService.archive_definition(definition)
        assert result.is_active is False

    @pytest.mark.django_db
    def test_restore_definition(self, definition: SettingDefinition) -> None:
        """Restore a definition."""
        definition.is_active = False
        definition.save()
        result = SettingDefinitionService.restore_definition(definition)
        assert result.is_active is True


class TestFeatureFlagService:
    """Tests for FeatureFlagService."""

    @pytest.mark.django_db
    def test_create_flag(self) -> None:
        """Create a feature flag through the service."""
        flag = FeatureFlagService.create_flag(
            code="svc.feature_flag",
            name="Test Feature",
            feature_type="boolean",
        )
        assert flag.uuid is not None
        assert flag.name == "Test Feature"

    @pytest.mark.django_db
    def test_update_flag(self, feature_flag: FeatureFlag) -> None:
        """Update a feature flag through the service."""
        updated = FeatureFlagService.update_flag(
            feature_flag, name="Updated Feature"
        )
        assert updated.name == "Updated Feature"

    @pytest.mark.django_db
    def test_delete_flag(self, feature_flag: FeatureFlag) -> None:
        """Delete a feature flag through the service."""
        FeatureFlagService.delete_flag(feature_flag)
        assert FeatureFlag.objects.filter(id=feature_flag.id).count() == 0

    @pytest.mark.django_db
    def test_enable_flag(self, feature_flag: FeatureFlag) -> None:
        """Enable a feature flag."""
        result = FeatureFlagService.enable_flag(feature_flag)
        assert result.status == FeatureFlag.STATUS_ENABLED

    @pytest.mark.django_db
    def test_disable_flag(self, feature_flag: FeatureFlag) -> None:
        """Disable a feature flag."""
        feature_flag.status = FeatureFlag.STATUS_ENABLED
        feature_flag.save()
        result = FeatureFlagService.disable_flag(feature_flag)
        assert result.status == FeatureFlag.STATUS_DISABLED

    @pytest.mark.django_db
    def test_schedule_flag(self, feature_flag: FeatureFlag) -> None:
        """Schedule a feature flag."""
        start = timezone.now() + timedelta(days=1)
        end = timezone.now() + timedelta(days=7)
        result = FeatureFlagService.schedule_flag(
            feature_flag, start, end
        )
        assert result.status == FeatureFlag.STATUS_SCHEDULED
        assert result.start_date == start
        assert result.end_date == end


class TestLocalizationService:
    """Tests for LocalizationService."""

    @pytest.mark.django_db
    def test_create_localization(self) -> None:
        """Create a localization through the service."""
        localization = LocalizationService.create_localization(
            code="svc.localization",
            name="English (US)",
            language=Localization.LANGUAGE_EN,
        )
        assert localization.uuid is not None
        assert localization.name == "English (US)"

    @pytest.mark.django_db
    def test_update_localization(self, localization: Localization) -> None:
        """Update a localization through the service."""
        updated = LocalizationService.update_localization(
            localization, name="Updated Localization"
        )
        assert updated.name == "Updated Localization"

    @pytest.mark.django_db
    def test_delete_localization(self, localization: Localization) -> None:
        """Delete a localization through the service."""
        LocalizationService.delete_localization(localization)
        assert Localization.objects.filter(id=localization.id).count() == 0

    @pytest.mark.django_db
    def test_activate_localization(self, localization: Localization) -> None:
        """Activate a localization."""
        localization.is_active = False
        localization.save()
        result = LocalizationService.activate_localization(localization)
        assert result.is_active is True

    @pytest.mark.django_db
    def test_deactivate_localization(self, localization: Localization) -> None:
        """Deactivate a localization."""
        result = LocalizationService.deactivate_localization(localization)
        assert result.is_active is False


class TestOrganizationSettingService:
    """Tests for OrganizationSettingService."""

    @pytest.mark.django_db
    def test_create_setting(self, organization, definition: SettingDefinition) -> None:
        """Create an organization setting through the service."""
        setting = OrganizationSettingService.create_setting(
            organization=organization,
            setting_code=definition.code,
            value={"key": "value"},
        )
        assert setting.uuid is not None
        assert setting.organization_id == organization.id
        assert setting.setting_id == definition.id
        assert setting.value == json.dumps({"key": "value"})

    @pytest.mark.django_db
    def test_update_setting(
        self, organization_setting: OrganizationSetting
    ) -> None:
        """Update an organization setting value."""
        updated = OrganizationSettingService.update_setting(
            organization_setting, {"key": "updated"}
        )
        assert updated.value == json.dumps({"key": "updated"})

    @pytest.mark.django_db
    def test_delete_setting(self, organization_setting: OrganizationSetting) -> None:
        """Delete an organization setting through the service."""
        OrganizationSettingService.delete_setting(organization_setting)
        assert (
            OrganizationSetting.objects.filter(id=organization_setting.id).count()
            == 0
        )

    @pytest.mark.django_db
    def test_delete_locked_setting_raises_permission_denied(
        self, organization_setting: OrganizationSetting
    ) -> None:
        """Deleting a locked setting raises PermissionDenied."""
        organization_setting.is_locked = True
        organization_setting.save()
        with pytest.raises(PermissionDenied):
            OrganizationSettingService.delete_setting(organization_setting)

    @pytest.mark.django_db
    def test_lock_and_unlock_setting(
        self, organization_setting: OrganizationSetting, user
    ) -> None:
        """Lock and unlock an organization setting."""
        locked = OrganizationSettingService.lock_setting(
            organization_setting, user
        )
        assert locked.is_locked is True
        assert locked.locked_by_id == user.id
        assert locked.locked_at is not None

        unlocked = OrganizationSettingService.unlock_setting(locked)
        assert unlocked.is_locked is False
        assert unlocked.locked_by is None
        assert unlocked.locked_at is None


class TestSystemSettingService:
    """Tests for SystemSettingService."""

    @pytest.mark.django_db
    def test_create_setting(self, definition: SettingDefinition) -> None:
        """Create a system setting through the service."""
        setting = SystemSettingService.create_setting(
            definition.code, {"key": "value"}
        )
        assert setting.uuid is not None
        assert setting.setting_id == definition.id
        assert setting.value == json.dumps({"key": "value"})

    @pytest.mark.django_db
    def test_update_setting(self, system_setting: SystemSetting) -> None:
        """Update a system setting value."""
        updated = SystemSettingService.update_setting(
            system_setting, {"key": "updated"}
        )
        assert updated.value == json.dumps({"key": "updated"})

    @pytest.mark.django_db
    def test_update_locked_setting_raises_permission_denied(
        self, system_setting: SystemSetting
    ) -> None:
        """Updating a locked setting raises PermissionDenied."""
        system_setting.is_locked = True
        system_setting.save()
        with pytest.raises(PermissionDenied):
            SystemSettingService.update_setting(system_setting, {"key": "x"})

    @pytest.mark.django_db
    def test_delete_setting(self, system_setting: SystemSetting) -> None:
        """Delete a system setting through the service."""
        SystemSettingService.delete_setting(system_setting)
        assert SystemSetting.objects.filter(id=system_setting.id).count() == 0

    @pytest.mark.django_db
    def test_delete_locked_setting_raises_permission_denied(
        self, system_setting: SystemSetting
    ) -> None:
        """Deleting a locked setting raises PermissionDenied."""
        system_setting.is_locked = True
        system_setting.save()
        with pytest.raises(PermissionDenied):
            SystemSettingService.delete_setting(system_setting)

    @pytest.mark.django_db
    def test_lock_and_unlock_setting(
        self, system_setting: SystemSetting, user
    ) -> None:
        """Lock and unlock a system setting."""
        locked = SystemSettingService.lock_setting(system_setting, user)
        assert locked.is_locked is True
        assert locked.locked_by_id == user.id
        assert locked.locked_at is not None

        unlocked = SystemSettingService.unlock_setting(locked)
        assert unlocked.is_locked is False
        assert unlocked.locked_by is None
        assert unlocked.locked_at is None
