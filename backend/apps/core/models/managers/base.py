from __future__ import annotations

from django.db import models

from apps.core.models.querysets import BaseQuerySet


class BaseManager(models.Manager.from_queryset(BaseQuerySet)):
    """
    Root manager for the entire project.

    All managers MUST inherit from this or be created using
    BaseManager.from_queryset().
    """

    # NOTE: Kept False because several managers are created dynamically via
    # ``BaseManager.from_queryset(...)`` at module level. Enabling migration
    # serialization for such dynamically generated managers requires them to be
    # importable by their generated class name, which they are not.
    use_in_migrations = False

    def get_queryset(self) -> BaseQuerySet:
        return super().get_queryset()

    def create(self, **kwargs):
        """
        Hook for future auditing or custom object creation.
        """
        return super().create(**kwargs)

    def bulk_create(self, objs, **kwargs):
        """
        Hook for future bulk operations.
        """
        return super().bulk_create(objs, **kwargs)

    def bulk_update(self, objs, fields, **kwargs):
        """
        Hook for future bulk updates.
        """
        return super().bulk_update(objs, fields, **kwargs)
