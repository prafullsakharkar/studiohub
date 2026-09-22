"""
Soft delete mixin.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.db import transaction

from apps.core.services.soft_delete import SoftDeleteService


class SoftDeleteMixin:
    """
    Soft delete operations.
    """

    if TYPE_CHECKING:

        @classmethod
        def validate(cls, operation: str, **kwargs: Any) -> None: ...

        @classmethod
        def publish_event(cls, operation: str, **kwargs: Any) -> None: ...

        @classmethod
        def invalidate_cache(cls, instance: Any) -> None: ...

    @classmethod
    @transaction.atomic
    def delete(
        cls,
        instance,
        *,
        user=None,
    ):
        cls.validate(
            "delete",
            instance=instance,
        )

        instance = SoftDeleteService.delete(
            instance,
            user=user,
        )

        cls.publish_event(
            "delete",
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def restore(
        cls,
        instance,
    ):
        cls.validate(
            "restore",
            instance=instance,
        )

        instance = SoftDeleteService.restore(instance)

        cls.publish_event(
            "restore",
            instance=instance,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def hard_delete(
        cls,
        instance,
    ):
        cls.validate(
            "hard_delete",
            instance=instance,
        )

        SoftDeleteService.hard_delete(instance)

        cls.publish_event(
            "hard_delete",
            instance=instance,
        )

        cls.invalidate_cache(instance)

    @classmethod
    def get_archived(cls, *, organization, project_id=None):
        """
        Soft-deleted records of an organization (optionally one project).

        Shared by every ``BusinessService`` subclass; the ``project_id``
        filter only applies when the model actually has a project field.
        """
        qs = cls.model.all_objects.filter(
            organization=organization,
            is_deleted=True,
        )
        if project_id and hasattr(cls.model, "project"):
            qs = qs.filter(project_id=project_id)
        return qs
