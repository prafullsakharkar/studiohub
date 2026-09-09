"""
Background Job validator.
"""
from __future__ import annotations

from typing import Any

from apps.audit.validators.base import AuditBaseValidator


class BackgroundJobValidator(AuditBaseValidator):
    """
    Validator for BackgroundJob.
    """
    
    def validate_job_type(self, job_type: str) -> bool:
        """
        Validate job type is valid.
        """
        from apps.audit.choices.background_job import JobType
        
        valid_types = [choice[0] for choice in JobType.choices]
        if job_type not in valid_types:
            self.errors["job_type"] = [f"Invalid job type: {job_type}"]
            return False
        return True
    
    def validate_status(self, status: str) -> bool:
        """
        Validate status is valid.
        """
        from apps.audit.choices.background_job import JobStatus
        
        valid_statuses = [choice[0] for choice in JobStatus.choices]
        if status not in valid_statuses:
            self.errors["status"] = [f"Invalid status: {status}"]
            return False
        return True
    
    def validate_progress(self, progress: int) -> bool:
        """
        Validate progress is between 0 and 100.
        """
        if progress is not None and (progress < 0 or progress > 100):
            self.errors["progress"] = ["Progress must be between 0 and 100"]
            return False
        return True
    
    def validate(self, **data: Any) -> bool:
        """
        Validate all fields.
        """
        self.errors = {}
        
        is_valid = True
        
        if "job_type" in data and not self.validate_job_type(data["job_type"]):
            is_valid = False

        if "status" in data and not self.validate_status(data["status"]):
            is_valid = False

        if "progress" in data and not self.validate_progress(data["progress"]):
            is_valid = False
        
        return is_valid
