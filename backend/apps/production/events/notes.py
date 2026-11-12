"""
Project note events (docs/review-pipeline RP-2 WP 2.5).

Published by ``ProjectNoteService`` and dispatched after commit by the core event bus. Payloads carry
ids and status names only. Nothing subscribes in RP-2; the in-app notifications of RP-6 will.
"""

from __future__ import annotations

from apps.core.events.base import DomainEvent


class NoteCreated(DomainEvent):
    """
    A thread was started.

    Payload: ``note_id``, ``thread_id`` (the same), ``project_id``, ``author_id``, ``task_id``,
    ``links`` (``{entity_type, entity_id}`` items).
    """


class NoteReplied(DomainEvent):
    """
    A reply was added to a thread.

    Payload: ``note_id`` (the reply), ``thread_id``, ``project_id``, ``author_id``, ``thread_author_id``.
    """


class NoteStatusChanged(DomainEvent):
    """
    A thread moved to another status.

    Payload: ``note_id``, ``thread_id``, ``project_id``, ``from_status``, ``to_status``, ``actor_id``.
    """
