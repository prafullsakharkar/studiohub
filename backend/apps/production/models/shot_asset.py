"""
ShotAsset - which assets a shot uses (WP C1, DECISIONS D-26).

A through table with its own data: how many of the asset the shot uses and a note. A shot and
an asset are linked at most once while the link is live (an unlinked row is soft-deleted and
stays as the trail); both must belong to the same project, which the service checks.
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases import EntityModel


class ShotAsset(EntityModel):
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="shot_assets",
    )
    shot = models.ForeignKey(
        "production.Shot",
        on_delete=models.PROTECT,
        related_name="asset_links",
    )
    asset = models.ForeignKey(
        "production.Asset",
        on_delete=models.PROTECT,
        related_name="shot_links",
    )
    quantity = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "production_shot_asset"
        ordering = ("created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["shot", "asset"],
                condition=models.Q(is_deleted=False),
                name="production_shotasset_live_pair_uniq",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1),
                name="production_shotasset_quantity_ck",
            ),
        ]
        indexes = [
            models.Index(fields=["project", "shot"]),
            models.Index(fields=["project", "asset"]),
        ]

    def __str__(self):
        return f"{self.shot_id} -> {self.asset_id} x{self.quantity}"  # pyright: ignore[reportAttributeAccessIssue]
