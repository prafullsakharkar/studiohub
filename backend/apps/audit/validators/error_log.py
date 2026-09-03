"""
Error Log validator.
"""
from __future__ import annotations

from typing import Any

from apps.audit.validators.base import AuditBaseValidator


class ErrorLogValidator(AuditBaseValidator):
    """
    Validator for ErrorLog.
    """
    
    def validate_severity(self, severity: str) -> bool:
        """
        Validate severity is valid.
        """
        from apps.audit.choices.error_log import ErrorSeverity
        
        valid_severities = [choice[0] for choice in ErrorSeverity.choices]
        if severity not in valid_severities:
            self.errors["severity"] = [f"Invalid severity: {severity}"]
            return False
        return True
    
    def validate_error_type(self, error_type: str) -> bool:
        """
        Validate error type is valid.
        """
        from apps.audit.choices.error_log import ErrorType
        
        valid_types = [choice[0] for choice in ErrorType.choices]
        if error_type not in valid_types:
            self.errors["error_type"] = [f"Invalid error type: {error_type}"]
            return False
        return True
    
    def validate_message(self, message: str) -> bool:
        """
        Validate message is not empty.
        """
        if not message or len(message) > 10000:
            self.errors["message"] = ["Message must be between 1 and 10000 characters"]
            return False
        return True
    
    def validate(self, **data: Any) -> bool:
        """
        Validate all fields.
        """
        self.errors = {}
        
        is_valid = True
        
        if "severity" in data and not self.validate_severity(data["severity"]):
            is_valid = False

        if "error_type" in data and not self.validate_error_type(data["error_type"]):
            is_valid = False

        if "message" in data and not self.validate_message(data["message"]):
            is_valid = False
        
        return is_valid
