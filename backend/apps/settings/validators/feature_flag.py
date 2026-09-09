"""
Feature Flag validator.
"""
from __future__ import annotations

from typing import Any

from apps.settings.validators.base import SettingsBaseValidator


class FeatureFlagValidator(SettingsBaseValidator):
    """
    Validator for FeatureFlag.
    """
    
    def validate_code(self, code: str) -> bool:
        """
        Validate the feature flag code format.
        """
        import re
        
        # Code must be lowercase with underscores or hyphens
        pattern = r"^[a-z0-9_-]+$"
        if not re.match(pattern, code):
            self.errors["code"] = [
                "Code must be lowercase with underscores or hyphens"
            ]
            return False
        
        return True
    
    def validate_percentage(self, percentage: int) -> bool:
        """
        Validate percentage is between 0 and 100.
        """
        if not isinstance(percentage, int):
            self.errors["percentage"] = ["Percentage must be an integer"]
            return False
        
        if percentage < 0 or percentage > 100:
            self.errors["percentage"] = ["Percentage must be between 0 and 100"]
            return False
        
        return True
    
    def validate_dates(self, start_date: Any, end_date: Any) -> bool:
        """
        Validate date range.
        """
        
        if start_date and end_date and start_date > end_date:
            self.errors["start_date"] = ["Start date must be before end date"]
            return False
        
        return True
    
    def validate(self, **data: Any) -> bool:
        """
        Validate all fields.
        """
        self.errors = {}
        
        is_valid = True
        
        if "code" in data and not self.validate_code(data["code"]):
            is_valid = False
        
        if "percentage" in data and not self.validate_percentage(data["percentage"]):
            is_valid = False
        
        if ("start_date" in data or "end_date" in data) and not self.validate_dates(
            data.get("start_date"), data.get("end_date")
        ):
            is_valid = False
        
        return is_valid
