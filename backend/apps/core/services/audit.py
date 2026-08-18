"""
Audit service.
"""

from __future__ import annotations

from .crud import CRUDService


class AuditService(CRUDService):
    """
    CRUD service with audit support.
    """

    @classmethod
    def create(
        cls,
        *,
        user=None,
        **validated_data,
    ):

        if user:

            validated_data["created_by"] = user

            validated_data["updated_by"] = user

        return super().create(
            **validated_data,
        )

    @classmethod
    def update(
        cls,
        instance,
        *,
        user=None,
        **validated_data,
    ):

        if user:

            validated_data["updated_by"] = user

        return super().update(
            instance,
            **validated_data,
        )

    @classmethod
    def delete(
        cls,
        instance,
        *,
        user=None,
    ):

        if (
            hasattr(
                instance,
                "deleted_by",
            )
            and user
        ):

            instance.deleted_by = user

            instance.save(
                update_fields=[
                    "deleted_by",
                ]
            )

        return super().delete(instance)
