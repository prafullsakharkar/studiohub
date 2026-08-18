"""
Activity validator.
"""
from __future__ import annotations

from typing import Any

from apps.audit.validators.base import AuditBaseValidator


class ActivityValidator(AuditBaseValidator):
    """
    Validator for Activity.
    """
    
    def validate_activity_type(self, activity_type: str) -> bool:
        """
        Validate activity type is valid.
        """
        from apps.audit.choices.activity import ActivityType
        
        valid_types = [choice[0] for choice in ActivityType.choices]
        if activity_type not in valid_types:
            self.errors["activity_type"] = [f"Invalid activity type: {activity_type}"]
            return False
        return True
    
    def validate_status(self, status: str) -> bool:
        """
        Validate status is valid.
        """
        from apps.audit.choices.activity import ActivityStatus
        
        valid_statuses = [choice[0] for choice in ActivityStatus.choices]
        if status not in valid_statuses:
            self.errors["status"] = [f"Invalid status: {status}"]
            return False
        return True
    
    def validate_duration(self, duration: int) -> bool:
        """
        Validate duration is reasonable.
        """
        if duration is not None and (duration < 0 or duration > 86400):
            self.errors["duration"] = ["Duration must be between 0 and 86400 seconds"]
            return False
        return True
    
    def validate(self, **data: Any) -> bool:
        """
        Validate all fields.
        """
        self.errors = {}
        
        is_valid = True
        
        if "activity_type" in data:
            if not self.validate_activity_type(data["activity_type"]):
                is_valid = False
        
        if "status" in data:
            if not self.validate_status(data["status"]):
                is_valid = False
        
        if "duration_seconds" in data:
            if not self.validate_duration(data["duration_seconds"]):
                is_valid = False
        
        return is_valid
