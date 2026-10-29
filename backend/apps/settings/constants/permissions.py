"""
Settings permissions — canonical dot-notation codes — see ADR-0033 D3.

Checked via global HasPermission (no org context).
"""


class SettingsPermissions:
    """Platform settings (system/category/definition/flags/theme/…)."""

    VIEW = "settings.view"
    MANAGE = "settings.manage"
