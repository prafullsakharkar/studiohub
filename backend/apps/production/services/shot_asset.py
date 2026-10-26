"""
Linking assets to shots (WP C1, DECISIONS D-26).

The shot and the asset must be live and belong to the same project; an asset of another project
reads exactly like one that does not exist. A pair is linked once while live (checked here for the
message, and by the database for the race). Unlinking soft-deletes the row.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from apps.core.services.soft_delete import SoftDeleteService
from apps.production.models import Asset, ShotAsset

ALREADY_LINKED = "This asset is already linked to the shot."


class ShotAssetService:
    @classmethod
    def resolve_asset(cls, project: Any, ref: Any) -> Asset:
        """The live asset of ``project`` named by id or code (any case), else 'Unknown asset.'."""
        text = str(ref or "").strip()
        base = Asset.objects.filter(project=project)
        asset = None
        if text:
            try:
                asset = base.filter(pk=UUID(text)).first()
            except ValueError:
                asset = base.filter(code__iexact=text).first()
        if asset is None:
            raise ValidationError({"asset_id": ["Unknown asset."]})
        return asset

    @classmethod
    @transaction.atomic
    def link(
        cls, *, user: Any, shot: Any, asset_ref: Any, quantity: int = 1, notes: str = ""
    ) -> ShotAsset:
        asset = cls.resolve_asset(shot.project, asset_ref)
        if ShotAsset.objects.filter(shot=shot, asset=asset).exists():
            raise ValidationError({"asset_id": [ALREADY_LINKED]})
        try:
            with transaction.atomic():
                return ShotAsset.objects.create(
                    project=shot.project,
                    shot=shot,
                    asset=asset,
                    quantity=quantity,
                    notes=notes,
                    created_by=user,
                    updated_by=user,
                )
        except IntegrityError:  # someone linked the same pair a moment ago
            raise ValidationError({"asset_id": [ALREADY_LINKED]}) from None

    @classmethod
    def find(cls, shot: Any, asset_ref: Any) -> ShotAsset | None:
        """The live link of ``shot`` to the asset named by id or code, or None."""
        try:
            asset = cls.resolve_asset(shot.project, asset_ref)
        except ValidationError:
            return None
        return ShotAsset.objects.filter(shot=shot, asset=asset).select_related("asset").first()

    @classmethod
    @transaction.atomic
    def update(
        cls, *, user: Any, link: ShotAsset, quantity: int | None = None, notes: str | None = None
    ) -> ShotAsset:
        if quantity is not None:
            link.quantity = quantity
        if notes is not None:
            link.notes = notes
        link.updated_by = user
        link.save()
        return link

    @classmethod
    @transaction.atomic
    def unlink(cls, *, user: Any, link: ShotAsset) -> None:
        SoftDeleteService.delete(link, user=user)
