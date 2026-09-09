"""
Setting Category validator.
"""

from __future__ import annotations

from apps.settings.validators.base import SettingsBaseValidator


class SettingCategoryValidator(SettingsBaseValidator):
    """
    Validator for SettingCategory.
    """

    def validate_code(self, code: str) -> bool:
        """
        Validate category code.
        """
        valid_codes = [
            "general",
            "project",
            "media",
            "workflow",
            "review",
            "delivery",
            "notification",
            "billing",
            "branding",
            "analytics",
            "ai",
            "localization",
            "theme",
            "security",
        ]
        if code not in valid_codes:
            self.errors["code"] = [
                f"Invalid category code. Must be one of: {', '.join(valid_codes)}"
            ]
            return False
        return True

    def validate_name(self, name: str) -> bool:
        """
        Validate category name.
        """
        if not name or len(name) < 2:
            self.errors["name"] = ["Name must be at least 2 characters"]
            return False
        return True

    def validate_icon(self, icon: str) -> bool:
        """
        Validate icon name.
        """
        if icon and len(icon) > 50:
            self.errors["icon"] = ["Icon name must be at most 50 characters"]
            return False
        return True

    def validate_order(self, order: int) -> bool:
        """
        Validate order value.
        """
        if order < 0:
            self.errors["order"] = ["Order must be a non-negative integer"]
            return False
        return True
