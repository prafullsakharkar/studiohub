"""
Turning the old JSON lists of a review into rows (WP E4, DECISIONS D-30).

Used by migration 0041 and by the seed commands, so it takes the model classes as arguments: the
migration passes its historical models, the seeds the real ones. Nothing here may import a model.
Do not change what it accepts or writes: migration 0041 relies on it.

The shapes of the old lists were never written down (only the seeds and the frontend mocks filled
them), so every key is read leniently and an entry that cannot be read is reported, never guessed.
The JSON columns are left alone; nothing is lost if an entry is skipped.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime
from types import SimpleNamespace
from typing import Any
from uuid import UUID

from django.utils import timezone
from django.utils.dateparse import parse_datetime

PENDING = "Pending Review"


def _uuid(value: Any) -> UUID | None:
    try:
        return UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


def _text(entry: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _when(entry: dict[str, Any], *keys: str) -> datetime | None:
    for key in keys:
        value = entry.get(key)
        if isinstance(value, str) and value:
            try:
                parsed = parse_datetime(value)
            except ValueError:
                parsed = None
            if parsed is not None:
                return timezone.make_aware(parsed) if timezone.is_naive(parsed) else parsed
    return None


def _int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        return int(value.strip())
    return None


def _flag(entry: dict[str, Any], *keys: str, default: bool = False) -> bool:
    for key in keys:
        if isinstance(entry.get(key), bool):
            return entry[key]
    return default


def _entries(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _stamp(model: Any, row: Any, when: datetime | None) -> None:
    """Give a converted row the time the old entry carried (``created_at`` is set on insert)."""
    if when is not None:
        model.objects.filter(pk=row.pk).update(created_at=when)


def _user(users: Any, raw: Any) -> Any:
    uid = _uuid(raw)
    return users.objects.filter(pk=uid).first() if uid else None


def import_review(
    review: Any,
    *,
    models: SimpleNamespace,
    only_empty: bool = True,
    dry_run: bool = False,
    lists: dict[str, Any] | None = None,
) -> list[str]:
    """
    Create rows for the old JSON lists of ``review``. ``models`` carries ``Version``, ``User`` and the six
    row classes (``Item``, ``Participant``, ``Comment``, ``Note``, ``Annotation``, ``Activity``).

    Returns the entries that could not be converted, one line each. A kind that already has rows is skipped
    when ``only_empty`` (the seeds run more than once). The old lists are read from ``lists`` (a dict by name)
    when given, else from the attributes of ``review`` (the migrations, whose historical model still has them). With ``dry_run`` nothing is read from or written to the
    row tables (they may not exist yet): only the problems are returned, for ``report_production_data``.
    """
    problems: list[str] = []
    label = review.code or str(review.pk)

    def old(name: str) -> list[Any]:
        return _entries(lists.get(name) if lists is not None else getattr(review, name, None))

    def skip(rows_model: Any) -> bool:
        return only_empty and not dry_run and rows_model.objects.filter(review=review).exists()

    def make(model: Any, **fields: Any) -> Any:
        if dry_run:
            return SimpleNamespace(pk=None)
        return model.objects.create(review=review, **fields)

    def stamp(model: Any, row: Any, when: datetime | None) -> None:
        if not dry_run:
            _stamp(model, row, when)

    if not skip(models.Item):
        seen: set[Any] = set()
        position = 0
        for index, entry in enumerate(old("versions")):
            if isinstance(entry, str):
                ref = entry
            elif isinstance(entry, dict):
                ref = entry.get("id") or entry.get("version_id")
            else:
                problems.append(f"review {label}: versions[{index}] is not an object")
                continue
            vid = _uuid(ref)
            version = (
                models.Version.objects.filter(pk=vid, project_id=review.project_id).first()
                if vid
                else None
            )
            if version is None and isinstance(entry, dict):
                code = _text(entry, "code", "version_code")
                if code:
                    version = models.Version.objects.filter(
                        code__iexact=code, project_id=review.project_id
                    ).first()
            if version is None or version.pk in seen:
                if version is None:
                    problems.append(
                        f"review {label}: versions[{index}] matches no version of the project"
                    )
                continue
            seen.add(version.pk)
            make(models.Item, version=version, position=position)
            position += 1

    if not skip(models.Participant):
        people: set[Any] = set()
        for index, entry in enumerate(old("reviewers")):
            if not isinstance(entry, dict):
                problems.append(f"review {label}: reviewers[{index}] is not an object")
                continue
            user = _user(models.User, entry.get("user_id"))
            if user is not None and user.pk in people:
                problems.append(
                    f"review {label}: reviewers[{index}] repeats a user already on the review"
                )
                continue
            if user is not None:
                people.add(user.pk)
            row = make(
                models.Participant,
                user=user,
                name=_text(entry, "name", "user_name", "full_name"),
                role=_text(entry, "role"),
                legacy_id=_text(entry, "id") or str(entry.get("id") or ""),
                verdict=_text(entry, "verdict") or PENDING,
                verdict_notes=_text(entry, "verdict_notes", "notes"),
                verdict_at=_when(entry, "verdict_date", "verdict_at"),
            )
            stamp(models.Participant, row, _when(entry, "created_at"))

    if not skip(models.Comment):
        for index, entry in enumerate(old("comments")):
            if not isinstance(entry, dict):
                problems.append(f"review {label}: comments[{index}] is not an object")
                continue
            root = _comment(make, stamp, models, entry, None)
            for reply in _entries(entry.get("replies")):
                if isinstance(reply, dict):
                    _comment(make, stamp, models, reply, root)
                else:
                    problems.append(
                        f"review {label}: a reply in comments[{index}] is not an object"
                    )

    if not skip(models.Note):
        for index, entry in enumerate(old("notes")):
            if not isinstance(entry, dict):
                problems.append(f"review {label}: notes[{index}] is not an object")
                continue
            row = make(
                models.Note,
                author_name=_text(entry, "author_name", "author"),
                author_role=_text(entry, "author_role"),
                category=_text(entry, "category") or "General",
                content=_text(entry, "content", "text", "body"),
                is_pinned=_flag(entry, "is_pinned", "pinned"),
            )
            stamp(models.Note, row, _when(entry, "created_at"))

    if not skip(models.Annotation):
        for index, entry in enumerate(old("annotations")):
            if not isinstance(entry, dict):
                problems.append(f"review {label}: annotations[{index}] is not an object")
                continue
            row = make(
                models.Annotation,
                author_name=_text(entry, "author_name", "author"),
                frame_number=_int(entry.get("frame_number")),
                timecode=_text(entry, "timecode"),
                comment=_text(entry, "comment", "text"),
                drawing_coordinates=entry.get("drawing_coordinates"),
            )
            stamp(models.Annotation, row, _when(entry, "created_at"))

    if not skip(models.Activity):
        for index, entry in enumerate(old("activity")):
            if not isinstance(entry, dict):
                problems.append(f"review {label}: activity[{index}] is not an object")
                continue
            row = make(
                models.Activity,
                action=(_text(entry, "action") or "NOTE")[:50],
                verdict=_text(entry, "verdict"),
                notes=_text(entry, "notes"),
                actor_email=_text(entry, "user", "actor"),
            )
            stamp(models.Activity, row, _when(entry, "timestamp", "created_at"))
    return problems


def _comment(
    make: Any, stamp: Any, models: SimpleNamespace, entry: dict[str, Any], parent: Any
) -> Any:
    resolved = _flag(entry, "is_resolved", "resolved")
    row = make(
        models.Comment,
        parent=parent if getattr(parent, "pk", None) else None,
        author_name=_text(entry, "author_name", "author"),
        text=_text(entry, "text", "body", "comment"),
        frame_number=_int(entry.get("frame_number")),
        timecode=_text(entry, "timecode"),
        is_client_visible=_flag(entry, "is_client_visible", default=True),
        tags=[t for t in _entries(entry.get("tags")) if isinstance(t, str)],
        resolved_at=(_when(entry, "resolved_at") or timezone.now()) if resolved else None,
    )
    stamp(models.Comment, row, _when(entry, "created_at"))
    return row


def affected_kinds(review: Any) -> Iterable[str]:
    """Which old lists of ``review`` hold anything (for the report)."""
    for name in ("versions", "reviewers", "comments", "notes", "annotations", "activity"):
        if _entries(getattr(review, name, None)):
            yield name
