from __future__ import annotations

from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.typing import ModelType


class BaseQuerySet(models.QuerySet[ModelType]):
    """
    Base queryset shared by all models.
    """

    def search(self, term: str) -> BaseQuerySet[ModelType]:
        """
        Search using model.search_fields.

        Example:

            search_fields = ("name", "code")
        """
        if not term:
            return self

        fields = getattr(self.model, "search_fields", ())

        if not fields:
            return self

        query = Q()

        for field in fields:
            query |= Q(**{f"{field}__icontains": term})

        return self.filter(query)

    def newest(self) -> BaseQuerySet[ModelType]:
        if hasattr(self.model, "created_at"):
            return self.order_by("-created_at")

        return self

    def oldest(self) -> BaseQuerySet[ModelType]:
        if hasattr(self.model, "created_at"):
            return self.order_by("created_at")

        return self


class SoftDeleteQuerySet(BaseQuerySet[ModelType]):
    """
    QuerySet implementing soft-delete support.
    """

    def active(self) -> SoftDeleteQuerySet[ModelType]:
        return self.filter(is_deleted=False)

    def deleted(self) -> SoftDeleteQuerySet[ModelType]:
        return self.filter(is_deleted=True)

    def delete(self):
        return self.update(
            is_deleted=True,
            deleted_at=timezone.now(),
        )

    def restore(self):
        return self.update(
            is_deleted=False,
            deleted_at=None,
        )

    def hard_delete(self):
        return super().delete()


class VisibleQuerySet(BaseQuerySet):
    """
    Placeholder for future visibility filtering.
    """

    def visible(self):
        return self
