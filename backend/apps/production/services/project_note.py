"""
Project notes: threads, replies, links, a task and a status (docs/review-pipeline RP-2, C-RP-07 to C-RP-13),
and the people a note mentions (RP-6, C-RP-25).

The views resolve and check the records a note names (``validators/project_note.py``) and decide the
caller's codes; this service writes, applies the authorship rules of Q-RP-11 and Q-RP-12, and
publishes ``NoteCreated``, ``NoteReplied``, ``NoteStatusChanged`` and ``NoteMentioned`` after commit.
"""

from __future__ import annotations

from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.events import default_event_bus
from apps.production.events.notes import (
    NoteCreated,
    NoteMentioned,
    NoteReplied,
    NoteStatusChanged,
)
from apps.production.models import (
    ProjectMembership,
    ProjectNote,
    ProjectNoteLink,
    ProjectNoteMention,
)
from apps.production.models.project_note import ProjectNoteStatus
from apps.production.validators.project_note import (
    NO_RECORD,
    ResolvedLink,
    record_code,
    record_name,
)

UNSET: Any = object()

# What a thread's edit may change (C-RP-12); a reply takes only its body.
THREAD_FIELDS = ("subject", "body", "category", "priority", "tags", "timecode_ref", "frame_number")
REPLY_FIELDS = ("body",)

NOT_YOURS_TO_EDIT = "Only the author, or someone who may edit notes, can change this note."
NOT_YOURS_TO_SET = (
    "Only the author, the task's assignee, or someone who may edit notes, can change its status."
)
NOT_YOURS_TO_DELETE = "Only the author, before anyone else has replied, or someone who may delete notes, can delete this note."
REPLY_HAS_NO_STATUS = "A reply has no status of its own."


def _display_name(user) -> str:
    return (getattr(user, "display_name", "") or getattr(user, "email", "") or "").strip()


def _author_fields(user, project) -> dict[str, Any]:
    """The author's name and role are the signed-in user's own (D-30), never the client's."""
    if user is None or not getattr(user, "pk", None):
        return {}
    membership = ProjectMembership.objects.filter(
        user=user, project=project, status__iexact="active"
    ).first()
    return {
        "author": user,
        "author_name": _display_name(user),
        "author_role": membership.role if membership else "",
        "author_avatar": "",
    }


def is_author(user, note: ProjectNote) -> bool:
    pk = getattr(user, "pk", None)
    return pk is not None and pk in {note.author_id, note.created_by_id}  # pyright: ignore[reportAttributeAccessIssue]


def _mirror(links: list[ResolvedLink]) -> dict[str, Any]:
    """The first link, in the four ``entity_*`` columns older clients read (C-RP-08)."""
    if not links:
        return {"entity_type": NO_RECORD, "entity_id": "", "entity_code": "", "entity_name": ""}
    first = links[0]
    return {
        "entity_type": first.entity_type,
        "entity_id": str(first.instance.pk),
        "entity_code": record_code(first.instance)[:50],
        "entity_name": record_name(first.instance)[:255],
    }


def _ids(note: ProjectNote) -> dict[str, Any]:
    return {
        "note_id": str(note.pk),
        "thread_id": str(note.parent_id or note.pk),  # pyright: ignore[reportAttributeAccessIssue]
        "project_id": str(note.project_id),  # pyright: ignore[reportAttributeAccessIssue]
    }


class ProjectNoteService:
    @classmethod
    def _write_links(cls, note: ProjectNote, links: list[ResolvedLink]) -> None:
        ProjectNoteLink.objects.filter(note=note).delete()
        for position, link in enumerate(links):
            ProjectNoteLink.objects.create(
                note=note,
                entity_type=link.entity_type,
                entity_id=link.instance.pk,
                position=position,
            )

    @classmethod
    def _write_mentions(cls, note: ProjectNote, users: list[Any]) -> list[str]:
        """Replace ``note``'s mentions with ``users``; the ids of the people it did not mention before."""
        before = {str(pk) for pk in note.mentions.values_list("user_id", flat=True)}  # pyright: ignore[reportAttributeAccessIssue]
        ProjectNoteMention.objects.filter(note=note).delete()
        ProjectNoteMention.objects.bulk_create(
            ProjectNoteMention(note=note, user=user, position=position)
            for position, user in enumerate(users)
        )
        return [str(user.pk) for user in users if str(user.pk) not in before]

    @classmethod
    @transaction.atomic
    def create_note(
        cls, *, user, project, links: list[ResolvedLink], task=None, mentions=(), **fields
    ) -> ProjectNote:
        """A new thread (C-RP-07): always ``Open``; links, mirror and author come from the server."""
        note = ProjectNote.objects.create(
            project=project,
            task=task,
            status=ProjectNoteStatus.OPEN,
            created_by=user,
            updated_by=user,
            **_author_fields(user, project),
            **_mirror(links),
            **fields,
        )
        cls._write_links(note, links)
        mention_ids = cls._write_mentions(note, list(mentions))
        default_event_bus.publish(
            NoteCreated(
                **_ids(note),
                author_id=str(user.pk) if user else None,
                task_id=str(task.pk) if task else None,
                links=[
                    {"entity_type": lk.entity_type, "entity_id": str(lk.instance.pk)}
                    for lk in links
                ],
                mention_ids=mention_ids,
            )
        )
        return note

    @classmethod
    @transaction.atomic
    def reply(cls, *, user, thread: ProjectNote, body: str, mentions=()) -> ProjectNote:
        """A reply on the thread's root (C-RP-11): its project, no links, no task, ``Open``."""
        root = thread.parent if thread.parent_id else thread  # pyright: ignore[reportAttributeAccessIssue]
        assert root is not None
        reply = ProjectNote.objects.create(
            project=root.project,
            parent=root,
            subject=f"Re: {root.subject}"[:255],
            body=body,
            category=root.category,
            status=ProjectNoteStatus.OPEN,
            created_by=user,
            updated_by=user,
            **_author_fields(user, root.project),
        )
        mention_ids = cls._write_mentions(reply, list(mentions))
        default_event_bus.publish(
            NoteReplied(
                **_ids(reply),
                author_id=str(user.pk) if user else None,
                thread_author_id=str(root.author_id) if root.author_id else None,  # pyright: ignore[reportAttributeAccessIssue]
                mention_ids=mention_ids,
            )
        )
        return reply

    @classmethod
    def require_editor(cls, *, user, note: ProjectNote, may_update: bool) -> None:
        """403 unless the caller wrote ``note`` or holds ``note.update`` (checked before the body is read)."""
        if not (may_update or is_author(user, note)):
            raise PermissionDenied(NOT_YOURS_TO_EDIT)

    @classmethod
    @transaction.atomic
    def update_note(
        cls,
        *,
        user,
        note: ProjectNote,
        fields: dict[str, Any],
        links: list[ResolvedLink] | None = None,
        task: Any = UNSET,
        mentions: list[Any] | None = None,
        may_update: bool,
    ) -> ProjectNote:
        """
        C-RP-12: the author, or a holder of ``note.update`` (Q-RP-11 = A). ``mentions`` replaces the
        note's mentions (a reply's too); only the people added are notified (C-RP-25).
        """
        cls.require_editor(user=user, note=note, may_update=may_update)
        is_reply = note.parent_id is not None  # pyright: ignore[reportAttributeAccessIssue]
        allowed = REPLY_FIELDS if is_reply else THREAD_FIELDS
        refused = sorted(set(fields) - set(allowed))
        if is_reply and (refused or links is not None or task is not UNSET):
            raise ValidationError({"detail": ["A reply takes only its body."]})
        for name in allowed:
            if name in fields:
                setattr(note, name, fields[name])
        if not is_reply:
            if task is not UNSET:
                note.task = task
            if links is not None:
                for name, value in _mirror(links).items():
                    setattr(note, name, value)
                cls._write_links(note, links)
        note.updated_by = user
        note.save()
        if mentions is not None:
            added = cls._write_mentions(note, mentions)
            if added:
                default_event_bus.publish(
                    NoteMentioned(
                        **_ids(note),
                        actor_id=str(user.pk) if user else None,
                        mention_ids=added,
                    )
                )
        return note

    @classmethod
    @transaction.atomic
    def set_status(cls, *, user, note: ProjectNote, status: str, may_update: bool) -> ProjectNote:
        """C-RP-13: the author, the assignee of the note's task, or a holder of ``note.update``."""
        if note.parent_id is not None:  # pyright: ignore[reportAttributeAccessIssue]
            raise ValidationError({"status": [REPLY_HAS_NO_STATUS]})
        assignee_id = note.task.assignee_id if note.task_id else None  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
        is_assignee = assignee_id is not None and assignee_id == getattr(user, "pk", None)
        if not (may_update or is_author(user, note) or is_assignee):
            raise PermissionDenied(NOT_YOURS_TO_SET)
        before = note.status
        if status == ProjectNoteStatus.ADDRESSED:
            note.addressed_by = _display_name(user)
            note.addressed_at = timezone.now()
        elif status == ProjectNoteStatus.OPEN:
            note.addressed_by = ""
            note.addressed_at = None
        note.status = status
        note.updated_by = user
        note.save()
        if before != status:
            default_event_bus.publish(
                NoteStatusChanged(
                    **_ids(note),
                    from_status=before,
                    to_status=status,
                    actor_id=str(user.pk) if user else None,
                )
            )
        return note

    @classmethod
    @transaction.atomic
    def delete_note(cls, *, user, note: ProjectNote, may_delete: bool) -> None:
        """
        C-RP-13 (Q-RP-12 = A): soft delete, by a holder of ``note.delete``, or by the author while
        no one else has replied. A thread takes its live replies with it.
        """
        replies = list(note.replies.filter(is_deleted=False)) if note.parent_id is None else []  # pyright: ignore[reportAttributeAccessIssue]
        if not may_delete:
            others = any(not is_author(user, reply) for reply in replies)
            if not is_author(user, note) or others:
                raise PermissionDenied(NOT_YOURS_TO_DELETE)
        for reply in replies:
            reply.delete(user=user)
        note.delete(user=user)
