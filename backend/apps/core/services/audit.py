"""
Audit service.
"""

from __future__ import annotations

from .base import BaseService


class AuditService(BaseService):
    """
    Service for audit fields.
    """

    @classmethod
    def mark_created(cls, instance, user):
        instance.created_by = user
        instance.updated_by = user

        instance.save(
            update_fields=[
                "created_by",
                "updated_by",
            ]
        )

        return instance

    @classmethod
    def mark_updated(cls, instance, user):
        instance.updated_by = user

        instance.save(update_fields=["updated_by"])

        return instance

    @classmethod
    def mark_deleted(cls, instance, user):
        instance.deleted_by = user

        instance.save(update_fields=["deleted_by"])

        return instance
