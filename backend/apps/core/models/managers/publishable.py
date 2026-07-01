"""
Publishable managers.
"""

from __future__ import annotations

from apps.core.models.managers.base import BaseManager
from apps.core.models.querysets import PublishableQuerySet


class PublishedManager(BaseManager.from_queryset(PublishableQuerySet)):
    """
    Manager exposing only published records.
    """

    def get_queryset(self) -> PublishableQuerySet:
        return super().get_queryset().published()


class AllPublishedManager(BaseManager.from_queryset(PublishableQuerySet)):
    """
    Manager exposing all publishable records.
    """

    def get_queryset(self) -> PublishableQuerySet:
        return super().get_queryset()
