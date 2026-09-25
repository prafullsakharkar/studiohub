"""
Platform permissions — canonical dot-notation codes — see ADR-0033 D3.

Mapped to the frontend Permission union (e.g. ``report.view``,
``notification.view``). Checked via HasPermission with organization
context.
"""


class PlatformPermissions:
    REPORTS_VIEW = "report.view"
    REPORTS_CREATE = "report.create"
    NOTIFICATIONS_VIEW = "notification.view"
    NOTIFICATIONS_UPDATE = "notification.update"


class SettingsPermissions:
    """Platform settings (system/category/definition/flags/theme/…)."""

    VIEW = "settings.view"
    MANAGE = "settings.manage"


class PlatformMasterDataPermissions:
    """Global master-data catalog administration (ADR-0033 D4)."""

    CONFIGURE = "platform.master_data.configure"
