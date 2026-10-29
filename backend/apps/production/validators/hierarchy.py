"""
A parent with live children cannot be archived (DECISIONS D-13), nor an asset that live shots
use (D-31).

Archiving a sequence or an episode would hide shots that still belong to it. The caller
archives or moves the children first, so nothing is hidden by accident and a restore
brings back exactly what was archived. Soft-deleted children do not count.
"""

from __future__ import annotations

from rest_framework.exceptions import ValidationError


class HasLiveChildren(ValidationError):
    """Archiving was refused because live children remain (bulk archive reports it as such)."""


def _plural(count: int, noun: str) -> str:
    return f"{count} {noun}" if count == 1 else f"{count} {noun}s"


def ensure_no_live_children(instance) -> None:
    """Raise a 400 naming the live children of a sequence or an episode, or the shots using an asset."""
    from apps.production.models import Asset, Episode, Sequence, Shot, ShotAsset

    if isinstance(instance, Asset):
        using = (
            ShotAsset.objects.filter(asset=instance, shot__is_deleted=False)
            .values("shot")
            .distinct()
            .count()
        )
        if using:
            raise HasLiveChildren(
                {
                    "detail": [
                        f"{instance.code} is still used by {_plural(using, 'shot')}. "
                        "Unlink it from them first."
                    ]
                }
            )
        return

    found = []
    if isinstance(instance, Sequence):
        found.append((Shot.objects.filter(sequence=instance).count(), "shot"))
    elif isinstance(instance, Episode):
        found.append((Sequence.objects.filter(episode=instance).count(), "sequence"))
        found.append((Shot.objects.filter(episode=instance).count(), "shot"))
    found = [(count, noun) for count, noun in found if count]
    if found:
        listed = " and ".join(_plural(count, noun) for count, noun in found)
        raise HasLiveChildren(
            {"detail": [f"{instance.code} still has {listed}. Archive or move them first."]}
        )
