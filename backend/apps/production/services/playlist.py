"""
Playlists and their entries (WP E5, DECISIONS D-31).

An entry is a row, so two people adding at once keep both and a version of another project cannot get
in by any route. The playlist row is locked while entries are added, removed or reordered, so positions
stay distinct and a reorder is not mixed with an add.
"""

from __future__ import annotations

import contextlib
from typing import Any
from uuid import UUID

from django.db import transaction
from django.db.models import Max
from rest_framework.exceptions import ValidationError

from apps.core.services.business import BusinessService
from apps.core.services.soft_delete import SoftDeleteService
from apps.production.models import Playlist, PlaylistEntry, Version
from apps.production.validators.references import resolve_in_project

UNKNOWN_ENTRY = "Unknown entry."


def _messages(detail: Any) -> list[Any]:
    """The messages inside a (possibly nested) validation detail, flattened."""
    if isinstance(detail, dict):
        return [m for value in detail.values() for m in _messages(value)]
    if isinstance(detail, list):
        return [m for value in detail for m in _messages(value)]
    return [detail]


class PlaylistService(BusinessService):
    model = Playlist

    @classmethod
    def _lock(cls, playlist: Playlist) -> None:
        Playlist._base_manager.select_for_update().get(pk=playlist.pk)

    @classmethod
    def entry(cls, playlist: Playlist, ref: Any) -> PlaylistEntry | None:
        """The live entry of ``playlist`` named by its id (or by the id the old list gave it)."""
        text = str(ref or "")
        rows = PlaylistEntry.objects.filter(playlist=playlist)
        found = None
        with contextlib.suppress(ValueError):
            found = rows.filter(pk=UUID(text)).first()
        if found is None and text:
            found = rows.filter(legacy_id=text).first()
        return found

    @classmethod
    def _add(cls, *, user, playlist, version_ref, extra) -> PlaylistEntry:
        version = (
            resolve_in_project(
                Version, playlist.project, version_ref, field="version_id", label="version"
            )
            if version_ref
            else None
        )
        last = PlaylistEntry.all_objects.filter(playlist=playlist).aggregate(m=Max("position"))["m"]
        return PlaylistEntry.objects.create(
            playlist=playlist,
            version=version,
            position=(last or 0) + 1,
            extra=extra or {},
            created_by=user,
            updated_by=user,
        )

    @classmethod
    @transaction.atomic
    def add_entry(cls, *, user, playlist, version_ref=None, extra=None) -> PlaylistEntry:
        """Put a version of the playlist's project (or a placeholder) last in the playlist."""
        cls._lock(playlist)
        return cls._add(user=user, playlist=playlist, version_ref=version_ref, extra=extra)

    @classmethod
    @transaction.atomic
    def add_entries(cls, *, user, playlist, entries: list[dict[str, Any]]) -> None:
        """The entries sent with a new playlist: each one checked like ``add_entry``."""
        cls._lock(playlist)
        for index, item in enumerate(entries):
            body = dict(item)
            version_ref = body.pop("version_id", None)
            for key in ("id", "entry_id", "item_order", "version_number"):
                body.pop(key, None)
            try:
                cls._add(user=user, playlist=playlist, version_ref=version_ref, extra=body)
            except ValidationError as exc:
                reason = " ".join(str(m) for m in _messages(exc.detail))
                raise ValidationError({"entries": [f"Entry {index + 1}: {reason}"]}) from None

    @classmethod
    @transaction.atomic
    def remove_entry(cls, *, user, playlist, ref) -> bool:
        """Take an entry off the playlist; an unknown id changes nothing (as it always did)."""
        cls._lock(playlist)
        row = cls.entry(playlist, ref)
        if row is None:
            return False
        SoftDeleteService.delete(row, user=user)
        return True

    @classmethod
    @transaction.atomic
    def reorder(cls, *, user, playlist, ordered_ids: list[Any]) -> None:
        """
        Put the listed entries first, in the order given; entries not listed follow in their old
        order (they are never dropped). An id that is not an entry of this playlist, or a repeat, is a 400.
        """
        cls._lock(playlist)
        chosen: list[PlaylistEntry] = []
        seen: set[Any] = set()
        for ref in ordered_ids:
            row = cls.entry(playlist, ref)
            if row is None or row.pk in seen:
                raise ValidationError({"entries": [UNKNOWN_ENTRY]})
            seen.add(row.pk)
            chosen.append(row)
        rest = [r for r in PlaylistEntry.objects.filter(playlist=playlist) if r.pk not in seen]
        for position, row in enumerate([*chosen, *rest], start=1):
            if row.position != position:
                row.position = position
                row.updated_by = user
                row.save(update_fields=["position", "updated_by", "updated_at"])

    @classmethod
    def import_legacy_json(cls, playlist) -> list[str]:
        """
        Turn the old JSON ``entries`` of ``playlist`` into rows (for the seed commands, which still read the
        frontend mocks); a playlist that already has rows is left alone. Returns what could not be read.
        """
        from types import SimpleNamespace

        from apps.production.services.playlist_legacy import import_playlist

        return import_playlist(
            playlist, models=SimpleNamespace(Version=Version, Entry=PlaylistEntry), only_empty=True
        )
