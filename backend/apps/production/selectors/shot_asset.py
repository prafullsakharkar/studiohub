"""Reads of the shot to asset links (WP C1). Archived shots and assets drop out of both directions."""

from __future__ import annotations

from django.db.models import QuerySet

from apps.production.models import ShotAsset


class ShotAssetSelector:
    @classmethod
    def for_shot(cls, shot) -> QuerySet[ShotAsset]:
        """The live links of ``shot`` to live assets, by asset code; one query for the lot."""
        return (
            ShotAsset.objects.filter(shot=shot, asset__is_deleted=False)
            .select_related("asset")
            .order_by("asset__code")
        )

    @classmethod
    def for_asset(cls, asset) -> QuerySet[ShotAsset]:
        """The live links of ``asset`` to live shots, by shot code; one query for the lot."""
        return (
            ShotAsset.objects.filter(asset=asset, shot__is_deleted=False)
            .select_related("shot")
            .order_by("shot__code")
        )
