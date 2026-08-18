"""
Login History validator.
"""
from __future__ import annotations

from typing import Any

from apps.audit.validators.base import AuditBaseValidator


class LoginHistoryValidator(AuditBaseValidator):
    """
    Validator for LoginHistory.
    """
    
    def validate_login_type(self, login_type: str) -> bool:
        """
        Validate login type is valid.
        """
        from apps.audit.choices.login_history import LoginType
        
        valid_types = [choice[0] for choice in LoginType.choices]
        if login_type not in valid_types:
            self.errors["login_type"] = [f"Invalid login type: {login_type}"]
            return False
        return True
    
    def validate_status(self, status: str) -> bool:
        """
        Validate status is valid.
        """
        from apps.audit.choices.login_history import LoginStatus
        
        valid_statuses = [choice[0] for choice in LoginStatus.choices]
        if status not in valid_statuses:
            self.errors["status"] = [f"Invalid status: {status}"]
            return False
        return True
    
    def validate(self, **data: Any) -> bool:
        """
        Validate all fields.
        """
        self.errors = {}
        
        is_valid = True
        
        if "login_type" in data:
            if not self.validate_login_type(data["login_type"]):
                is_valid = False
        
        if "status" in data:
            if not self.validate_status(data["status"]):
                is_valid = False
        
        return is_valid
