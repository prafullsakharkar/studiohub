"""Responses for the shot to asset links, seen from the shot and from the asset (WP C1)."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.production.models import ShotAsset


class ShotAssetSerializer(serializers.ModelSerializer[Any]):
    """A link as the shot sees it: the asset with its quantity and note."""

    asset_id = serializers.UUIDField(read_only=True)
    asset_code = serializers.CharField(source="asset.code", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    asset_category = serializers.CharField(source="asset.category", read_only=True)
    asset_status = serializers.CharField(source="asset.status", read_only=True)
    thumbnail_url = serializers.CharField(source="asset.thumbnail_url", read_only=True)

    class Meta:
        model = ShotAsset
        fields = (
            "id",
            "shot_id",
            "asset_id",
            "asset_code",
            "asset_name",
            "asset_category",
            "asset_status",
            "thumbnail_url",
            "quantity",
            "notes",
            "created_at",
        )
        read_only_fields = fields


class AssetShotSerializer(serializers.ModelSerializer[Any]):
    """A link as the asset sees it: the shot with its quantity and note."""

    shot_id = serializers.UUIDField(read_only=True)
    shot_code = serializers.CharField(source="shot.code", read_only=True)
    shot_name = serializers.CharField(source="shot.name", read_only=True)
    shot_status = serializers.CharField(source="shot.status", read_only=True)

    class Meta:
        model = ShotAsset
        fields = (
            "id",
            "asset_id",
            "shot_id",
            "shot_code",
            "shot_name",
            "shot_status",
            "quantity",
            "notes",
            "created_at",
        )
        read_only_fields = fields
