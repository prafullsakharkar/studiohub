"""
Localization validator.
"""
from __future__ import annotations

from typing import Any

from apps.settings.validators.base import SettingsBaseValidator


class LocalizationValidator(SettingsBaseValidator):
    """
    Validator for Localization.
    """
    
    def validate_currency_code(self, code: str) -> bool:
        """
        Validate currency code format (ISO 4217).
        """
        if not isinstance(code, str):
            self.errors["currency_code"] = ["Currency code must be a string"]
            return False
        
        if len(code) != 3:
            self.errors["currency_code"] = ["Currency code must be 3 characters"]
            return False
        
        if not code.isupper():
            self.errors["currency_code"] = ["Currency code must be uppercase"]
            return False
        
        return True
    
    def validate_week_start(self, week_start: int) -> bool:
        """
        Validate week start day (0=Sunday, 1=Monday).
        """
        if not isinstance(week_start, int):
            self.errors["week_start"] = ["Week start must be an integer"]
            return False
        
        if week_start < 0 or week_start > 6:
            self.errors["week_start"] = ["Week start must be between 0 and 6"]
            return False
        
        return True
    
    def validate(self, **data: Any) -> bool:
        """
        Validate all fields.
        """
        self.errors = {}
        
        is_valid = True
        
        if "currency_code" in data and not self.validate_currency_code(
            data["currency_code"]
        ):
            is_valid = False
        
        if "week_start" in data and not self.validate_week_start(data["week_start"]):
            is_valid = False
        
        return is_valid
