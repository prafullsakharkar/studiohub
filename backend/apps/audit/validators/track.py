"""
Track validator.
"""
from __future__ import annotations

from typing import Any

from apps.audit.validators.base import AuditBaseValidator


class TrackValidator(AuditBaseValidator):
    """
    Validator for Track.
    """
    
    def validate_event_type(self, event_type: str) -> bool:
        """
        Validate event type is valid.
        """
        from apps.audit.choices.track import TrackEventType
        
        valid_types = [choice[0] for choice in TrackEventType.choices]
        if event_type not in valid_types:
            self.errors["event_type"] = [f"Invalid event type: {event_type}"]
            return False
        return True
    
    def validate(self, **data: Any) -> bool:
        """
        Validate all fields.
        """
        self.errors = {}
        
        is_valid = True
        
        if "event_type" in data:
            if not self.validate_event_type(data["event_type"]):
                is_valid = False
        
        return is_valid
