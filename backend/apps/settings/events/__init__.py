"""
Settings app events.

Events follow the Core ``DomainEvent`` contract: subclasses declare an
``event_type`` and carry their payload in ``.payload`` via ``**kwargs``.
"""

from __future__ import annotations

from apps.core.events.base import DomainEvent


class ThemeCreated(DomainEvent):
    """Event triggered when a new theme is created."""

    event_type = "theme.created"


class ThemeUpdated(DomainEvent):
    """Event triggered when a theme is updated."""

    event_type = "theme.updated"


class ThemeDeleted(DomainEvent):
    """Event triggered when a theme is deleted."""

    event_type = "theme.deleted"


class CategoryCreated(DomainEvent):
    """Event triggered when a new category is created."""

    event_type = "category.created"


class CategoryUpdated(DomainEvent):
    """Event triggered when a category is updated."""

    event_type = "category.updated"


class CategoryDeleted(DomainEvent):
    """Event triggered when a category is deleted."""

    event_type = "category.deleted"


class DefinitionCreated(DomainEvent):
    """Event triggered when a new definition is created."""

    event_type = "definition.created"


class DefinitionUpdated(DomainEvent):
    """Event triggered when a definition is updated."""

    event_type = "definition.updated"


class DefinitionDeleted(DomainEvent):
    """Event triggered when a definition is deleted."""

    event_type = "definition.deleted"


class FeatureFlagCreated(DomainEvent):
    """Event triggered when a new feature flag is created."""

    event_type = "feature_flag.created"


class FeatureFlagUpdated(DomainEvent):
    """Event triggered when a feature flag is updated."""

    event_type = "feature_flag.updated"


class FeatureFlagDeleted(DomainEvent):
    """Event triggered when a feature flag is deleted."""

    event_type = "feature_flag.deleted"


class LocalizationCreated(DomainEvent):
    """Event triggered when a new localization is created."""

    event_type = "localization.created"


class LocalizationUpdated(DomainEvent):
    """Event triggered when a localization is updated."""

    event_type = "localization.updated"


class LocalizationDeleted(DomainEvent):
    """Event triggered when a localization is deleted."""

    event_type = "localization.deleted"


class OrganizationSettingCreated(DomainEvent):
    """Event triggered when a new organization setting is created."""

    event_type = "organization_setting.created"


class OrganizationSettingUpdated(DomainEvent):
    """Event triggered when an organization setting is updated."""

    event_type = "organization_setting.updated"


class OrganizationSettingDeleted(DomainEvent):
    """Event triggered when an organization setting is deleted."""

    event_type = "organization_setting.deleted"


class SystemSettingCreated(DomainEvent):
    """Event triggered when a new system setting is created."""

    event_type = "system_setting.created"


class SystemSettingUpdated(DomainEvent):
    """Event triggered when a system setting is updated."""

    event_type = "system_setting.updated"


class SystemSettingDeleted(DomainEvent):
    """Event triggered when a system setting is deleted."""

    event_type = "system_setting.deleted"
