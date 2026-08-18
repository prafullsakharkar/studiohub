# tests/integration/test_settings_integration.py
"""
Integration tests for Settings application workflow.
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
from apps.settings.selectors.category import SettingCategorySelector
from apps.settings.selectors.definition import SettingDefinitionSelector
from apps.settings.selectors.feature_flag import FeatureFlagSelector
from apps.settings.selectors.localization import LocalizationSelector
from apps.settings.selectors.organization import OrganizationSettingSelector
from apps.settings.selectors.system import SystemSettingSelector
from apps.settings.selectors.theme import ThemeSelector
from apps.settings.services.category import SettingCategoryService
from apps.settings.services.definition import SettingDefinitionService
from apps.settings.services.feature_flag import FeatureFlagService
from apps.settings.services.localization import LocalizationService
from apps.settings.services.organization import OrganizationSettingService
from apps.settings.services.system import SystemSettingService
from apps.settings.services.theme import ThemeService


class TestSettingsWorkflow:
    """Tests for Settings workflow."""

    @pytest.mark.django_db
    def test_full_theme_workflow(self) -> None:
        """Test complete workflow: create, read, update, delete."""
        # Create
        theme = ThemeService.create_theme(
            name="Test Theme",
            code="itest_theme",
            theme_type="light",
        )
        assert theme.uuid is not None

        # Read
        assert ThemeSelector.get_by_code("itest_theme").id == theme.id

        # Update
        theme.name = "Updated Theme"
        theme.save()
        theme.refresh_from_db()
        assert theme.name == "Updated Theme"

        # Delete
        ThemeService.delete_theme(theme)
        assert Theme.objects.filter(id=theme.id).count() == 0

    @pytest.mark.django_db
    def test_full_category_workflow(self) -> None:
        """Test complete workflow: create, read, update, delete."""
        # Create
        category = SettingCategoryService.create_category(
            name="Test Category",
            code=SettingCategory.GENERAL,
        )
        assert category.uuid is not None

        # Read
        assert (
            SettingCategorySelector.get_by_code(SettingCategory.GENERAL).id
            == category.id
        )

        # Update
        category.name = "Updated Category"
        category.save()
        category.refresh_from_db()
        assert category.name == "Updated Category"

        # Delete
        SettingCategoryService.delete_category(category)
        assert SettingCategory.objects.filter(id=category.id).count() == 0

    @pytest.mark.django_db
    def test_full_definition_workflow(self) -> None:
        """Test complete workflow: create, read, update, delete."""
        # Create
        category = SettingCategoryService.create_category(
            name="Integration Category",
            code=SettingCategory.GENERAL,
        )
        definition = SettingDefinitionService.create_definition(
            name="Test Definition",
            code="itest_definition",
            category=category,
            data_type=SettingDefinition.TYPE_STRING,
        )
        assert definition.uuid is not None

        # Read
        assert (
            SettingDefinitionSelector.get_by_code("itest_definition").id
            == definition.id
        )

        # Update
        definition.name = "Updated Definition"
        definition.save()
        definition.refresh_from_db()
        assert definition.name == "Updated Definition"

        # Delete
        SettingDefinitionService.delete_definition(definition)
        assert SettingDefinition.objects.filter(id=definition.id).count() == 0

    @pytest.mark.django_db
    def test_full_feature_flag_workflow(self) -> None:
        """Test complete workflow: create, read, update, delete."""
        # Create
        flag = FeatureFlagService.create_flag(
            name="Test Feature",
            code="itest_feature",
            feature_type="boolean",
        )
        assert flag.uuid is not None

        # Read
        assert FeatureFlagSelector.get_by_code("itest_feature").id == flag.id

        # Update
        flag.name = "Updated Feature"
        flag.save()
        flag.refresh_from_db()
        assert flag.name == "Updated Feature"

        # Delete
        FeatureFlagService.delete_flag(flag)
        assert FeatureFlag.objects.filter(id=flag.id).count() == 0

    @pytest.mark.django_db
    def test_full_localization_workflow(self) -> None:
        """Test complete workflow: create, read, update, delete."""
        # Create
        localization = LocalizationService.create_localization(
            name="Test Localization",
            code="itest_localization",
            language=Localization.LANGUAGE_EN,
        )
        assert localization.uuid is not None

        # Read
        assert (
            LocalizationSelector.get_by_code("itest_localization").id
            == localization.id
        )

        # Update
        localization.name = "Updated Localization"
        localization.save()
        localization.refresh_from_db()
        assert localization.name == "Updated Localization"

        # Delete
        LocalizationService.delete_localization(localization)
        assert Localization.objects.filter(id=localization.id).count() == 0

    @pytest.mark.django_db
    def test_full_organization_setting_workflow(
        self, organization, definition: SettingDefinition
    ) -> None:
        """Test complete workflow: create, read, update, delete."""
        # Create
        setting = OrganizationSettingService.create_setting(
            organization=organization,
            setting_code=definition.code,
            value={"key": "value"},
        )
        assert setting.uuid is not None

        # Read
        assert setting in OrganizationSettingSelector.for_organization(
            organization
        )

        # Update
        setting.value = '{"key": "updated"}'
        setting.save()
        setting.refresh_from_db()
        assert setting.value == '{"key": "updated"}'

        # Delete
        OrganizationSettingService.delete_setting(setting)
        assert OrganizationSetting.objects.filter(id=setting.id).count() == 0

    @pytest.mark.django_db
    def test_full_system_setting_workflow(self, definition: SettingDefinition) -> None:
        """Test complete workflow: create, read, update, delete."""
        # Create
        setting = SystemSettingService.create_setting(
            definition.code,
            {"key": "value"},
        )
        assert setting.uuid is not None

        # Read
        assert SystemSettingSelector.get_by_setting(definition.code).id == setting.id

        # Update
        setting.value = '{"key": "updated"}'
        setting.save()
        setting.refresh_from_db()
        assert setting.value == '{"key": "updated"}'

        # Delete
        SystemSettingService.delete_setting(setting)
        assert SystemSetting.objects.filter(id=setting.id).count() == 0
