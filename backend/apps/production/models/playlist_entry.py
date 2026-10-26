"""
PlaylistEntry - one version (or placeholder) on a playlist, in order (WP E5, DECISIONS D-31).

Replaces the JSON list ``Playlist.entries``. The version, when there is one, must belong to the
playlist's project; the service checks it. The related name is ``entry_rows`` because
``Playlist.entries`` is still an attribute of the model until the contract phase.
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases import EntityModel


class PlaylistEntry(EntityModel):
    playlist = models.ForeignKey(
        "production.Playlist", on_delete=models.CASCADE, related_name="entry_rows"
    )
    version = models.ForeignKey(
        "production.Version",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="playlist_entries",
    )
    #: 1, 2, 3 ... in play order (gaps appear when an entry is removed)
    position = models.PositiveIntegerField(default=1)
    #: the id the old JSON entry had; clients that still send it keep working
    legacy_id = models.CharField(max_length=100, blank=True, default="", db_index=True)
    #: any other keys the client put on the entry (notes_count, label ...), passed through
    extra = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "production_playlist_entry"
        ordering = ("position", "created_at")
        indexes = [models.Index(fields=["playlist", "position"])]

    def __str__(self):
        return f"{self.playlist_id} #{self.position}"  # pyright: ignore[reportAttributeAccessIssue]
