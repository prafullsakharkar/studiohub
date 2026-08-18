# tests/events/test_settings_events.py
"""
Event tests for Settings application.
"""

from __future__ import annotations

from apps.settings.events import (
    CategoryCreated,
    CategoryDeleted,
    CategoryUpdated,
    DefinitionCreated,
    DefinitionDeleted,
    DefinitionUpdated,
    FeatureFlagCreated,
    FeatureFlagDeleted,
    FeatureFlagUpdated,
    LocalizationCreated,
    LocalizationDeleted,
    LocalizationUpdated,
    OrganizationSettingCreated,
    OrganizationSettingDeleted,
    OrganizationSettingUpdated,
    SystemSettingCreated,
    SystemSettingDeleted,
    SystemSettingUpdated,
    ThemeCreated,
    ThemeDeleted,
    ThemeUpdated,
)

THEME_UUID = "123e4567-e89b-12d3-a456-426614174000"


class TestThemeEvents:
    """Tests for Theme events."""

    def test_theme_created_event(self) -> None:
        """Test ThemeCreated event."""
        event = ThemeCreated(
            theme_uuid=THEME_UUID,
            name="Test Theme",
        )
        assert event.event_type == "theme.created"
        assert event.payload["theme_uuid"] == THEME_UUID
        assert event.payload["name"] == "Test Theme"

    def test_theme_updated_event(self) -> None:
        """Test ThemeUpdated event."""
        event = ThemeUpdated(
            theme_uuid=THEME_UUID,
            name="Updated Theme",
        )
        assert event.event_type == "theme.updated"
        assert event.payload["theme_uuid"] == THEME_UUID
        assert event.payload["name"] == "Updated Theme"

    def test_theme_deleted_event(self) -> None:
        """Test ThemeDeleted event."""
        event = ThemeDeleted(theme_uuid=THEME_UUID)
        assert event.event_type == "theme.deleted"
        assert event.payload["theme_uuid"] == THEME_UUID


class TestCategoryEvents:
    """Tests for Category events."""

    def test_category_created_event(self) -> None:
        """Test CategoryCreated event."""
        event = CategoryCreated(
            category_uuid=THEME_UUID,
            name="General",
        )
        assert event.event_type == "category.created"
        assert event.payload["name"] == "General"

    def test_category_updated_event(self) -> None:
        """Test CategoryUpdated event."""
        event = CategoryUpdated(
            category_uuid=THEME_UUID,
            name="Updated",
        )
        assert event.event_type == "category.updated"
        assert event.payload["name"] == "Updated"

    def test_category_deleted_event(self) -> None:
        """Test CategoryDeleted event."""
        event = CategoryDeleted(category_uuid=THEME_UUID)
        assert event.event_type == "category.deleted"


class TestDefinitionEvents:
    """Tests for Definition events."""

    def test_definition_created_event(self) -> None:
        """Test DefinitionCreated event."""
        event = DefinitionCreated(
            definition_uuid=THEME_UUID,
            name="Setting",
        )
        assert event.event_type == "definition.created"
        assert event.payload["name"] == "Setting"

    def test_definition_updated_event(self) -> None:
        """Test DefinitionUpdated event."""
        event = DefinitionUpdated(
            definition_uuid=THEME_UUID,
            name="Updated",
        )
        assert event.event_type == "definition.updated"

    def test_definition_deleted_event(self) -> None:
        """Test DefinitionDeleted event."""
        event = DefinitionDeleted(definition_uuid=THEME_UUID)
        assert event.event_type == "definition.deleted"


class TestFeatureFlagEvents:
    """Tests for FeatureFlag events."""

    def test_feature_flag_created_event(self) -> None:
        """Test FeatureFlagCreated event."""
        event = FeatureFlagCreated(
            feature_flag_uuid=THEME_UUID,
            name="Feature",
        )
        assert event.event_type == "feature_flag.created"
        assert event.payload["name"] == "Feature"

    def test_feature_flag_updated_event(self) -> None:
        """Test FeatureFlagUpdated event."""
        event = FeatureFlagUpdated(
            feature_flag_uuid=THEME_UUID,
            name="Updated",
        )
        assert event.event_type == "feature_flag.updated"

    def test_feature_flag_deleted_event(self) -> None:
        """Test FeatureFlagDeleted event."""
        event = FeatureFlagDeleted(feature_flag_uuid=THEME_UUID)
        assert event.event_type == "feature_flag.deleted"


class TestLocalizationEvents:
    """Tests for Localization events."""

    def test_localization_created_event(self) -> None:
        """Test LocalizationCreated event."""
        event = LocalizationCreated(
            localization_uuid=THEME_UUID,
            name="English",
        )
        assert event.event_type == "localization.created"
        assert event.payload["name"] == "English"

    def test_localization_updated_event(self) -> None:
        """Test LocalizationUpdated event."""
        event = LocalizationUpdated(
            localization_uuid=THEME_UUID,
            name="Updated",
        )
        assert event.event_type == "localization.updated"

    def test_localization_deleted_event(self) -> None:
        """Test LocalizationDeleted event."""
        event = LocalizationDeleted(localization_uuid=THEME_UUID)
        assert event.event_type == "localization.deleted"


class TestOrganizationSettingEvents:
    """Tests for OrganizationSetting events."""

    def test_organization_setting_created_event(self) -> None:
        """Test OrganizationSettingCreated event."""
        event = OrganizationSettingCreated(
            organization_setting_uuid=THEME_UUID,
            organization_id="org-1",
        )
        assert event.event_type == "organization_setting.created"
        assert event.payload["organization_id"] == "org-1"

    def test_organization_setting_updated_event(self) -> None:
        """Test OrganizationSettingUpdated event."""
        event = OrganizationSettingUpdated(
            organization_setting_uuid=THEME_UUID,
            organization_id="org-1",
        )
        assert event.event_type == "organization_setting.updated"

    def test_organization_setting_deleted_event(self) -> None:
        """Test OrganizationSettingDeleted event."""
        event = OrganizationSettingDeleted(
            organization_setting_uuid=THEME_UUID
        )
        assert event.event_type == "organization_setting.deleted"


class TestSystemSettingEvents:
    """Tests for SystemSetting events."""

    def test_system_setting_created_event(self) -> None:
        """Test SystemSettingCreated event."""
        event = SystemSettingCreated(system_setting_uuid=THEME_UUID)
        assert event.event_type == "system_setting.created"

    def test_system_setting_updated_event(self) -> None:
        """Test SystemSettingUpdated event."""
        event = SystemSettingUpdated(system_setting_uuid=THEME_UUID)
        assert event.event_type == "system_setting.updated"

    def test_system_setting_deleted_event(self) -> None:
        """Test SystemSettingDeleted event."""
        event = SystemSettingDeleted(system_setting_uuid=THEME_UUID)
        assert event.event_type == "system_setting.deleted"
