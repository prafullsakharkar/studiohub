"""
Background Job selector.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.audit.models.background_job import BackgroundJob

from .base import AuditBaseSelector


class BackgroundJobSelector(AuditBaseSelector):
    """
    Read operations for BackgroundJob.
    """
    
    model = BackgroundJob
    
    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return cls._scope_by_request(
            cls.model.objects.all(),
            request=request,
        )
    
    @classmethod
    def get_by_id(cls, background_job_id: str):
        """
        Get a background job by its ID.
        """
        return cls.get_queryset().get(id=background_job_id)
    
    @classmethod
    def by_organization(cls, organization_id: str):
        """
        Get background jobs for an organization.
        """
        return cls.get_queryset().filter(organization_id=organization_id)
    
    @classmethod
    def by_type(cls, job_type: str):
        """
        Get background jobs by type.
        """
        return cls.get_queryset().filter(job_type=job_type)
    
    @classmethod
    def by_status(cls, status: str):
        """
        Get background jobs by status.
        """
        return cls.get_queryset().filter(status=status)
