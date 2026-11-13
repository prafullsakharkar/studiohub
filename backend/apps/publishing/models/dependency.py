"""
Dependencies between published files (review-pipeline RP-4, C-RP-16).

A row says that ``downstream`` was built from ``upstream``. Rows are written with the downstream
file when it is registered and never change (Q-RP-19 = A): every upstream exists before its
downstream, so no cycle can form. Both files are of one project (Q-RP-20 = A).
"""

from __future__ import annotations

import uuid
from typing import Any

from django.conf import settings
from django.db import models
from django.utils import timezone

#: the most upstreams one registration may name
MAX_UPSTREAMS = 50


class PublishedFileDependencyQuerySet(models.QuerySet[Any]):
    def update(self, **kwargs: Any) -> int:
        raise TypeError("PublishedFileDependency is append-only.")

    def delete(self) -> tuple[int, dict[str, int]]:
        raise TypeError("PublishedFileDependency is append-only.")


class PublishedFileDependency(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    downstream = models.ForeignKey(
        "publishing.PublishedFile", on_delete=models.PROTECT, related_name="upstream_links"
    )
    upstream = models.ForeignKey(
        "publishing.PublishedFile", on_delete=models.PROTECT, related_name="downstream_links"
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    objects = PublishedFileDependencyQuerySet.as_manager()

    class Meta:
        db_table = "publishing_file_dependency"
        ordering = ("created_at", "id")
        constraints = [
            models.UniqueConstraint(
                fields=["downstream", "upstream"], name="publishing_dependency_pair_uniq"
            ),
            models.CheckConstraint(
                condition=~models.Q(downstream=models.F("upstream")),
                name="publishing_dependency_not_self_ck",
            ),
        ]
        indexes = [models.Index(fields=["upstream"], name="publishing_dep_upstream_idx")]

    def __str__(self) -> str:
        return f"{self.downstream_id} <- {self.upstream_id}"  # pyright: ignore[reportAttributeAccessIssue]

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self._state.adding:
            raise TypeError("PublishedFileDependency is append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise TypeError("PublishedFileDependency is append-only.")
