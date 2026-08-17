"""
Audit service.
"""

from __future__ import annotations

from apps.core.services.crud import CRUDService


class AuditService(CRUDService):
    """
    CRUD service with audit support.
    """

    @classmethod
    def _do_create(cls, *, user=None, **validated_data):
        """Internal method to create instance with audit fields."""
        if user:
            validated_data["created_by"] = user
            validated_data["updated_by"] = user
        return super()._do_create(user=user, **validated_data)

    @classmethod
    def _do_update(cls, instance, *, user=None, **validated_data):
        """Internal method to update instance with audit fields."""
        if user:
            validated_data["updated_by"] = user
        return super()._do_update(instance, user=user, **validated_data)

    @classmethod
    def _do_delete(cls, instance, *, user=None):
        """Internal method to delete instance with audit fields."""
        if hasattr(instance, "deleted_by") and user:
            instance.deleted_by = user
            instance.save(update_fields=["deleted_by"])
        return super()._do_delete(instance, user=user)
