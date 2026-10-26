"""
The JSON shapes the frontend reads for the parts of a review, built from their rows (WP E4, D-30).
"""

from __future__ import annotations

from typing import Any


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def item_dict(item: Any) -> dict[str, Any]:
    version = item.version
    return {
        "id": str(version.pk),
        "item_id": str(item.pk),
        "code": version.code,
        "version_number": version.version_number,
        "status": version.status,
        "order": item.position,
    }


def participant_dict(row: Any) -> dict[str, Any]:
    user = row.user
    return {
        "id": str(row.pk),
        "legacy_id": row.legacy_id,
        "user_id": str(row.user_id) if row.user_id else None,
        "name": row.name or (getattr(user, "display_name", "") if user else ""),
        "role": row.role,
        "verdict": row.verdict,
        "verdict_notes": row.verdict_notes,
        "verdict_date": _iso(row.verdict_at),
    }


def comment_dict(row: Any, *, replies: bool = True) -> dict[str, Any]:
    data = {
        "id": str(row.pk),
        "parent_id": str(row.parent_id) if row.parent_id else None,
        "author": row.author_name,
        "author_id": str(row.author_id) if row.author_id else None,
        "text": row.text,
        "frame_number": row.frame_number,
        "timecode": row.timecode or None,
        "is_client_visible": row.is_client_visible,
        "tags": row.tags or [],
        "is_resolved": row.resolved_at is not None,
        "resolved_at": _iso(row.resolved_at),
        "resolved_by_id": str(row.resolved_by_id) if row.resolved_by_id else None,
        "created_at": _iso(row.created_at),
    }
    if replies:
        data["replies"] = [comment_dict(r, replies=False) for r in row.replies.all()]
    return data


def note_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.pk),
        "category": row.category,
        "author_name": row.author_name,
        "author_id": str(row.author_id) if row.author_id else None,
        "author_role": row.author_role,
        "content": row.content,
        "is_pinned": row.is_pinned,
        "created_at": _iso(row.created_at),
    }


def annotation_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.pk),
        "frame_number": row.frame_number,
        "timecode": row.timecode or None,
        "author_name": row.author_name,
        "author_id": str(row.author_id) if row.author_id else None,
        "comment": row.comment,
        "drawing_coordinates": row.drawing_coordinates,
        "created_at": _iso(row.created_at),
    }


def activity_dict(row: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "id": str(row.pk),
        "action": row.action,
        "notes": row.notes,
        "user": row.actor_email,
        "timestamp": _iso(row.created_at),
    }
    if row.verdict:
        data["verdict"] = row.verdict
    return data
