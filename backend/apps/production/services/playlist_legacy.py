"""
Turning the old JSON ``entries`` of a playlist into rows (WP E5, DECISIONS D-31).

Used by migration 0043, the seed commands and ``report_production_data`` (dry run), so it takes the
model classes as arguments. Nothing here may import a model. Do not change what it accepts or
writes: migration 0043 relies on it.

An entry names a version by ``version_id`` (or none: a placeholder). A version that is not in the
playlist's project is exactly what the API refuses today, so such an entry is reported and skipped,
never linked. The JSON column stays.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from uuid import UUID

#: keys that become columns; every other key is kept in ``extra``
OWN_KEYS = frozenset({"id", "entry_id", "version_id", "item_order", "version_number"})


def _uuid(value: Any) -> UUID | None:
    try:
        return UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


def _order(entry: Any, index: int) -> tuple[int, int]:
    value = entry.get("item_order") if isinstance(entry, dict) else None
    number = value if isinstance(value, int) and not isinstance(value, bool) else index + 1
    return (number, index)


def import_playlist(
    playlist: Any,
    *,
    models: SimpleNamespace,
    only_empty: bool = True,
    dry_run: bool = False,
    entries: Any = None,
) -> list[str]:
    """
    Create entry rows for the old ``entries`` list of ``playlist``. ``models`` carries ``Version`` and
    ``Entry``. Returns the entries that could not be converted, one line each. With ``dry_run`` nothing is
    read from or written to the entry table (it may not exist yet). The old list comes from ``entries`` when
    given, else from the playlist's own ``entries`` attribute (the migrations' historical model).
    """
    problems: list[str] = []
    label = playlist.code or str(playlist.pk)
    source = entries if entries is not None else getattr(playlist, "entries", None)
    raw = source if isinstance(source, list) else []
    if only_empty and not dry_run and models.Entry.objects.filter(playlist=playlist).exists():
        return problems
    ordered = sorted(range(len(raw)), key=lambda i: _order(raw[i], i))
    position = 0
    for index in ordered:
        entry = raw[index]
        if not isinstance(entry, dict):
            problems.append(f"playlist {label}: entries[{index}] is not an object")
            continue
        version = None
        if entry.get("version_id") not in (None, ""):
            vid = _uuid(entry["version_id"])
            version = (
                models.Version.objects.filter(pk=vid, project_id=playlist.project_id).first()
                if vid
                else None
            )
            if version is None:
                problems.append(
                    f"playlist {label}: entries[{index}] names no version of the project"
                )
                continue
        position += 1
        if dry_run:
            continue
        models.Entry.objects.create(
            playlist=playlist,
            version=version,
            position=position,
            legacy_id=str(entry.get("id") or entry.get("entry_id") or "")[:100],
            extra={k: v for k, v in entry.items() if k not in OWN_KEYS},
        )
    return problems
