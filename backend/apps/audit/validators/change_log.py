"""
Change Log validator.
"""
from __future__ import annotations

from typing import Any

from apps.audit.validators.base import AuditBaseValidator


class ChangeLogValidator(AuditBaseValidator):
    """
    Validator for ChangeLog.
    """
    
    def validate_change_type(self, change_type: str) -> bool:
        """
        Validate change type is valid.
        """
        from apps.audit.choices.change_log import ChangeType
        
        valid_types = [choice[0] for choice in ChangeType.choices]
        if change_type not in valid_types:
            self.errors["change_type"] = [f"Invalid change type: {change_type}"]
            return False
        return True
    
    def validate_before_after(self, before: dict, after: dict) -> bool:
        """
        Validate before and after values are dictionaries.
        """
        if not isinstance(before, dict):
            self.errors["before_values"] = ["Before values must be a dictionary"]
            return False
        
        if not isinstance(after, dict):
            self.errors["after_values"] = ["After values must be a dictionary"]
            return False
        
        return True
    
    def validate_changed_fields(self, changed_fields: list) -> bool:
        """
        Validate changed fields is a list.
        """
        if not isinstance(changed_fields, list):
            self.errors["changed_fields"] = ["Changed fields must be a list"]
            return False
        
        return True
    
    def validate(self, **data: Any) -> bool:
        """
        Validate all fields.
        """
        self.errors = {}
        
        is_valid = True
        
        if "change_type" in data:
            if not self.validate_change_type(data["change_type"]):
                is_valid = False
        
        if "before_values" in data and "after_values" in data:
            if not self.validate_before_after(
                data["before_values"], data["after_values"]
            ):
                is_valid = False
        
        if "changed_fields" in data:
            if not self.validate_changed_fields(data["changed_fields"]):
                is_valid = False
        
        return is_valid
