"""
Project note events (docs/review-pipeline RP-2 WP 2.5).

Published by ``ProjectNoteService`` and dispatched after commit by the core event bus. Payloads carry
ids and status names only. The in-app notifications of RP-6 subscribe (C-RP-24, C-RP-25).
"""

from __future__ import annotations

from apps.core.events.base import DomainEvent


class NoteCreated(DomainEvent):
    """
    A thread was started.

    Payload: ``note_id``, ``thread_id`` (the same), ``project_id``, ``author_id``, ``task_id``,
    ``links`` (``{entity_type, entity_id}`` items), ``mention_ids`` (RP-6).
    """


class NoteReplied(DomainEvent):
    """
    A reply was added to a thread.

    Payload: ``note_id`` (the reply), ``thread_id``, ``project_id``, ``author_id``, ``thread_author_id``,
    ``mention_ids`` (RP-6).
    """


class NoteStatusChanged(DomainEvent):
    """
    A thread moved to another status.

    Payload: ``note_id``, ``thread_id``, ``project_id``, ``from_status``, ``to_status``, ``actor_id``.
    """


class NoteMentioned(DomainEvent):
    """
    An edit added people to a note's mentions (RP-6, C-RP-25). A new thread or reply carries its
    mentions in ``NoteCreated`` or ``NoteReplied`` instead.

    Payload: ``note_id``, ``thread_id``, ``project_id``, ``actor_id``, ``mention_ids`` (only the
    people the edit added).
    """
