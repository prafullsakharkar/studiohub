"""
Audit Log validator.
"""
from __future__ import annotations

from typing import Any

from apps.audit.validators.base import AuditBaseValidator


class AuditLogValidator(AuditBaseValidator):
    """
    Validator for AuditLog.
    """
    
    def validate_action(self, action: str) -> bool:
        """
        Validate action is a valid audit action.
        """
        from apps.audit.choices.audit_log import AuditAction
        
        valid_actions = [choice[0] for choice in AuditAction.choices]
        if action not in valid_actions:
            self.errors["action"] = [f"Invalid action: {action}"]
            return False
        return True
    
    def validate_severity(self, severity: str) -> bool:
        """
        Validate severity is a valid audit severity.
        """
        from apps.audit.choices.audit_log import AuditSeverity
        
        valid_severities = [choice[0] for choice in AuditSeverity.choices]
        if severity not in valid_severities:
            self.errors["severity"] = [f"Invalid severity: {severity}"]
            return False
        return True
    
    def validate_target(self, target: str) -> bool:
        """
        Validate target is a valid audit target.
        """
        from apps.audit.choices.audit_log import AuditTarget
        
        valid_targets = [choice[0] for choice in AuditTarget.choices]
        if target not in valid_targets:
            self.errors["target"] = [f"Invalid target: {target}"]
            return False
        return True
    
    def validate(self, **data: Any) -> bool:
        """
        Validate all fields.
        """
        self.errors = {}
        
        is_valid = True
        
        if "action" in data:
            if not self.validate_action(data["action"]):
                is_valid = False
        
        if "severity" in data:
            if not self.validate_severity(data["severity"]):
                is_valid = False
        
        if "target_type" in data:
            if not self.validate_target(data["target_type"]):
                is_valid = False
        
        return is_valid
