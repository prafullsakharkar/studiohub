"""
Setting Definition validator.
"""

from __future__ import annotations

from typing import Any

from apps.settings.validators.base import SettingsBaseValidator


class SettingDefinitionValidator(SettingsBaseValidator):
    """
    Validator for SettingDefinition.
    """

    def validate_code(self, code: str) -> bool:
        """
        Validate definition code.
        """
        if not code or len(code) < 2:
            self.errors["code"] = ["Code must be at least 2 characters"]
            return False
        if "." not in code:
            self.errors["code"] = [
                "Code must contain a dot separator (e.g., 'match.auto_score')"
            ]
            return False
        return True

    def validate_name(self, name: str) -> bool:
        """
        Validate definition name.
        """
        if not name or len(name) < 2:
            self.errors["name"] = ["Name must be at least 2 characters"]
            return False
        return True

    def validate_data_type(self, data_type: str) -> bool:
        """
        Validate data type.
        """
        valid_types = [
            "string",
            "integer",
            "float",
            "boolean",
            "date",
            "datetime",
            "json",
            "text",
            "email",
            "url",
            "phone",
            "color",
            "select",
            "multiple_select",
        ]
        if data_type not in valid_types:
            self.errors["data_type"] = [
                f"Invalid data type. Must be one of: {', '.join(valid_types)}"
            ]
            return False
        return True

    def validate_scope(self, scope: str) -> bool:
        """
        Validate scope.
        """
        valid_scopes = ["organization", "system"]
        if scope not in valid_scopes:
            self.errors["scope"] = [
                f"Invalid scope. Must be one of: {', '.join(valid_scopes)}"
            ]
            return False
        return True

    def validate_is_required(self, is_required: bool) -> bool:
        """
        Validate is_required flag.
        """
        return True

    def validate_default_value(self, default_value: str, data_type: str) -> bool:
        """
        Validate default value based on data type.
        """
        if not default_value:
            return True

        if data_type in ["integer", "float"]:
            try:
                float(default_value)
            except ValueError, TypeError:
                self.errors["default_value"] = ["Default value must be a valid number"]
                return False

        return True
