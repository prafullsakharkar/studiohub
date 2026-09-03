"""
API Request validator.
"""
from __future__ import annotations

from typing import Any

from apps.audit.validators.base import AuditBaseValidator


class APIRequestValidator(AuditBaseValidator):
    """
    Validator for APIRequest.
    """
    
    def validate_method(self, method: str) -> bool:
        """
        Validate HTTP method is valid.
        """
        from apps.audit.choices.api_request import HttpMethod
        
        valid_methods = [choice[0] for choice in HttpMethod.choices]
        if method not in valid_methods:
            self.errors["method"] = [f"Invalid HTTP method: {method}"]
            return False
        return True
    
    def validate_status_code(self, status_code: int) -> bool:
        """
        Validate status code is valid.
        """
        if not isinstance(status_code, int):
            self.errors["status_code"] = ["Status code must be an integer"]
            return False
        
        if status_code < 100 or status_code > 599:
            self.errors["status_code"] = ["Status code must be between 100 and 599"]
            return False
        
        return True
    
    def validate_response_time(self, response_time: int) -> bool:
        """
        Validate response time is reasonable.
        """
        if response_time is not None and (response_time < 0 or response_time > 300000):
            self.errors["response_time"] = ["Response time must be between 0 and 300000 ms"]
            return False
        return True
    
    def validate(self, **data: Any) -> bool:
        """
        Validate all fields.
        """
        self.errors = {}
        
        is_valid = True
        
        if "method" in data and not self.validate_method(data["method"]):
            is_valid = False

        if "status_code" in data and not self.validate_status_code(data["status_code"]):
            is_valid = False

        if "response_time_ms" in data and not self.validate_response_time(data["response_time_ms"]):
            is_valid = False
        
        return is_valid
