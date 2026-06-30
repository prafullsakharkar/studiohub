from __future__ import annotations

from django.db import models

from apps.core.typing import ModelType

from .querysets import (
    SoftDeleteQuerySet,
    VisibleQuerySet,
)


class BaseManager(models.Manager[ModelType]):
    """
    Base manager inherited by all managers.
    """

    pass


class SoftDeleteManager(BaseManager.from_queryset(SoftDeleteQuerySet)):
    """
    Default manager that hides deleted records.
    """

    def get_queryset(self) -> SoftDeleteQuerySet[ModelType]:
        return super().get_queryset().active()


class AllObjectsManager(BaseManager.from_queryset(SoftDeleteQuerySet)):
    """
    Includes deleted rows.
    """

    def get_queryset(self) -> SoftDeleteQuerySet[ModelType]:
        return super().get_queryset()


class VisibleManager(models.Manager.from_queryset(VisibleQuerySet)):
    """
    Future use.
    """

    def get_queryset(self):
        return super().get_queryset().visible()
