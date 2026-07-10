"""
Base manager for all application models.
"""

from __future__ import annotations

from django.db import models

from apps.core.models.querysets import BaseQuerySet


class BaseManager(models.Manager.from_queryset(BaseQuerySet)):
    """
    Base manager shared across all models.

    Extend this class to implement specialized managers.
    """

    # See apps.core.models.managers.base.BaseManager for rationale.
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
