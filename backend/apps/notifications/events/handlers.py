"""
Who is told what (docs/review-pipeline RP-6, C-RP-24; the table in PLAN.md, "Who is notified").

The bus dispatches these synchronously once the action has committed, before the request's answer
is sent (or in the worker, for review media). A notification must never turn a saved action into a
failed one, so every handler logs ``notification_fanout_failed`` and swallows the error.
"""

from __future__ import annotations

from typing import Any

from apps.core.events.handlers import DomainEventHandler
from apps.core.logging.logger import get_logger
from apps.notifications.constants import Kind, TargetType
from apps.notifications.services.fanout import FanoutService, merge
from apps.production.selectors.notification_sources import NotificationSources

logger = get_logger("notifications")


class _Handler(DomainEventHandler):
    def handle(self, event) -> None:
        try:
            self.notify(event.payload)
        except Exception:
            logger.exception("notification_fanout_failed", event=type(event).__name__)

    def notify(self, payload: dict[str, Any]) -> None:
        raise NotImplementedError


def _mentions(payload: dict[str, Any]) -> tuple[list[Any], str]:
    return list(payload.get("mention_ids") or []), Kind.NOTE_MENTION


class NoteCreatedHandler(_Handler):
    """A thread was started: its task's assignee, the artists of its linked versions, the mentioned."""

    def notify(self, payload):
        task = NotificationSources.task(payload.get("task_id")) if payload.get("task_id") else None
        versions = [
            link["entity_id"]
            for link in payload.get("links") or []
            if str(link.get("entity_type", "")).lower() == "version"
        ]
        involved = [task["assignee_id"]] if task else []
        involved += NotificationSources.version_artists(versions)
        FanoutService.notify(
            kinds=merge((involved, Kind.NOTE_CREATED), _mentions(payload)),
            actor_id=payload.get("author_id"),
            project_id=payload["project_id"],
            target_type=TargetType.NOTE,
            target_id=payload["thread_id"],
        )


class NoteRepliedHandler(_Handler):
    """A reply: the thread's author, everyone who replied, its task's assignee, the mentioned."""

    def notify(self, payload):
        thread = NotificationSources.thread(payload["thread_id"])
        if thread is None:
            return
        involved = [thread["author_id"], *thread["reply_author_ids"], thread["task_assignee_id"]]
        FanoutService.notify(
            kinds=merge((involved, Kind.NOTE_REPLY), _mentions(payload)),
            actor_id=payload.get("author_id"),
            project_id=thread["project_id"],
            target_type=TargetType.NOTE,
            target_id=payload["thread_id"],
        )


class NoteStatusHandler(_Handler):
    """A thread changed status: its author and its task's assignee."""

    def notify(self, payload):
        thread = NotificationSources.thread(payload["thread_id"])
        if thread is None:
            return
        FanoutService.notify(
            kinds=merge(([thread["author_id"], thread["task_assignee_id"]], Kind.NOTE_STATUS)),
            actor_id=payload.get("actor_id"),
            project_id=thread["project_id"],
            target_type=TargetType.NOTE,
            target_id=payload["thread_id"],
            data={"from_status": payload.get("from_status"), "to_status": payload.get("to_status")},
        )


class NoteMentionedHandler(_Handler):
    """An edit added people to a note's mentions: those people only."""

    def notify(self, payload):
        FanoutService.notify(
            kinds=merge(_mentions(payload)),
            actor_id=payload.get("actor_id"),
            project_id=payload["project_id"],
            target_type=TargetType.NOTE,
            target_id=payload["thread_id"],
        )


class TaskAssignedHandler(_Handler):
    """A task was given to someone: the new assignee (not when they assigned it to themselves)."""

    def notify(self, payload):
        FanoutService.notify(
            kinds=merge(([payload.get("to_assignee_id")], Kind.TASK_ASSIGNED)),
            actor_id=payload.get("actor_id"),
            project_id=payload["project_id"],
            target_type=TargetType.TASK,
            target_id=payload["task_id"],
        )


class StatusChangedHandler(_Handler):
    """A task's or a version's status changed: the task's assignee; the version's artist and task's assignee."""

    def notify(self, payload):
        entity_type = payload.get("entity_type")
        data = {"from_status": payload.get("from_status"), "to_status": payload.get("to_status")}
        if entity_type == "Task":
            task = NotificationSources.task(payload["entity_id"])
            if task is None:
                return
            kinds = merge(([task["assignee_id"]], Kind.TASK_STATUS))
            project_id, target_type = task["project_id"], TargetType.TASK
        elif entity_type == "Version":
            version = NotificationSources.version(payload["entity_id"])
            if version is None:
                return
            kinds = merge(
                ([version["artist_id"], version["task_assignee_id"]], Kind.VERSION_STATUS)
            )
            project_id, target_type = version["project_id"], TargetType.VERSION
        else:
            return
        FanoutService.notify(
            kinds=kinds,
            actor_id=payload.get("actor_id"),
            project_id=project_id,
            target_type=target_type,
            target_id=payload["entity_id"],
            data=data,
        )


class ReviewMediaFinishedHandler(_Handler):
    """A review movie is ready or failed: the person who uploaded it."""

    def notify(self, payload):
        failed = payload.get("status") == "failed"
        FanoutService.notify(
            kinds=merge(
                (
                    [payload.get("created_by_id")],
                    Kind.REVIEW_MEDIA_FAILED if failed else Kind.REVIEW_MEDIA_READY,
                )
            ),
            actor_id=None,
            project_id=payload["project_id"],
            target_type=TargetType.VERSION,
            target_id=payload["version_id"],
            data={"error_code": payload.get("error_code") or ""} if failed else {},
        )
