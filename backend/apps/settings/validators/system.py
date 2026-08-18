"""
System Setting validator.
"""
from __future__ import annotations

import json
from typing import Any

from apps.settings.validators.base import SettingsBaseValidator


class SystemSettingValidator(SettingsBaseValidator):
    """
    Validator for SystemSetting.
    """
    
    def validate_setting(self, setting_code: str) -> bool:
        """
        Validate that the setting code exists.
        """
        from apps.settings.models.definition import SettingDefinition
        
        try:
            SettingDefinition.objects.get(code=setting_code)
            return True
        except SettingDefinition.DoesNotExist:
            self.errors["setting"] = [f"Setting '{setting_code}' does not exist"]
            return False
    
    def validate_value(self, value: Any, data_type: str) -> bool:
        """
        Validate the setting value based on data type.
        """
        if value is None:
            return True
        
        if data_type == "integer":
            try:
                int(value)
                return True
            except (ValueError, TypeError):
                self.errors["value"] = ["Value must be an integer"]
                return False
        
        elif data_type == "float":
            try:
                float(value)
                return True
            except (ValueError, TypeError):
                self.errors["value"] = ["Value must be a number"]
                return False
        
        elif data_type == "boolean":
            if not isinstance(value, bool):
                self.errors["value"] = ["Value must be a boolean"]
                return False
        
        elif data_type == "json":
            try:
                json.dumps(value)
                return True
            except (TypeError, ValueError):
                self.errors["value"] = ["Value must be valid JSON"]
                return False
        
        return True
    
    def validate(self, **data: Any) -> bool:
        """
        Validate all fields.
        """
        self.errors = {}
        
        is_valid = True
        
        if "setting" in data:
            if not self.validate_setting(data["setting"]):
                is_valid = False
        
        if "value" in data and "setting" in data:
            # Get the data type from the setting
            from apps.settings.models.definition import SettingDefinition
            try:
                setting = SettingDefinition.objects.get(code=data["setting"])
                if not self.validate_value(data["value"], setting.data_type):
                    is_valid = False
            except SettingDefinition.DoesNotExist:
                pass
        
        return is_valid
