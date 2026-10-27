"""
One file of a delivery item, copied from the published file registry (DOM-DLV-04).

Until the delivery is sent this is a preview that ``prepare`` refreshes; sending freezes it
(``frozen_at``) and from then on it never changes, whatever happens to the version or the file.
``published_file_id`` is a plain UUID, not a foreign key: Deliveries keeps no hard link into
Publishing's tables.
"""

from __future__ import annotations

from typing import Any

from django.db import models


class FrozenSnapshotError(ValueError):
    """A snapshot that was frozen when the delivery was sent was about to change."""


class ItemFileQuerySet(models.QuerySet["DeliveryItemFile"]):
    """Bulk changes and deletes are refused while any row they touch is frozen."""

    def _refuse_if_frozen(self) -> None:
        if self.filter(frozen_at__isnull=False).exists():
            raise FrozenSnapshotError("This file was frozen when the delivery was sent.")

    def update(self, **kwargs: Any) -> int:
        self._refuse_if_frozen()
        return super().update(**kwargs)

    def delete(self) -> tuple[int, dict[str, int]]:
        self._refuse_if_frozen()
        return super().delete()


class DeliveryItemFile(models.Model):
    item = models.ForeignKey(
        "deliveries.DeliveryVersionRef", on_delete=models.PROTECT, related_name="files"
    )
    published_file_id = models.UUIDField()
    storage_root_code = models.CharField(max_length=50)
    relative_path = models.CharField(max_length=1024)
    role = models.CharField(max_length=20)
    file_type_code = models.CharField(max_length=100, blank=True, default="")
    size_bytes = models.PositiveBigIntegerField(default=0)
    sha256 = models.CharField(max_length=64)
    frame_start = models.IntegerField(null=True, blank=True)
    frame_end = models.IntegerField(null=True, blank=True)
    frozen_at = models.DateTimeField(null=True, blank=True)

    objects = ItemFileQuerySet.as_manager()

    class Meta:
        db_table = "deliveries_item_file"
        ordering = ("role", "relative_path")
        constraints = [
            models.UniqueConstraint(
                fields=["item", "published_file_id"], name="deliveries_item_file_uniq"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.storage_root_code}:{self.relative_path}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk is not None and self._was_frozen():
            raise FrozenSnapshotError("This file was frozen when the delivery was sent.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        if self.frozen_at is not None or self._was_frozen():
            raise FrozenSnapshotError("This file was frozen when the delivery was sent.")
        return super().delete(*args, **kwargs)

    def _was_frozen(self) -> bool:
        return (
            type(self)
            .objects.filter(pk=self.pk, frozen_at__isnull=False)  # pyright: ignore[reportAttributeAccessIssue]
            .exists()
        )
