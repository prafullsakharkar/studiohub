"""
Who is told what (docs/review-pipeline RP-6, C-RP-24; RP-11, C-RP-28; RP-13, C-RP-35; the tables
in PLAN.md, "Who is notified").

The bus dispatches these synchronously once the action has committed, before the request's answer
is sent (or in the worker, for review media). A notification must never turn a saved action into a
failed one, so every handler logs ``notification_fanout_failed`` and swallows the error.
"""

from __future__ import annotations

from typing import Any

from apps.core.events.handlers import DomainEventHandler
from apps.core.logging.logger import get_logger
from apps.deliveries.constants import workflow as delivery_flow
from apps.deliveries.selectors.notification_sources import DeliveryNotificationSources
from apps.notifications.constants import REVIEW_DECISIONS, Kind, TargetType
from apps.notifications.services.fanout import FanoutService, merge
from apps.production.selectors.notification_sources import NotificationSources
from apps.publishing.selectors.notification_sources import PublishingNotificationSources
from apps.scheduling.selectors.notification_sources import ScheduleNotificationSources

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


def _review_decision(review_id: Any, decision: Any, actor_id: Any) -> None:
    """
    A review reached a decision: the artists of its live versions (with the assignees of their tasks) and its
    participants (C-RP-28).
    """
    if decision not in REVIEW_DECISIONS:
        return
    review = NotificationSources.review(review_id)
    if review is None:
        return
    FanoutService.notify(
        kinds=merge(
            (review["version_artist_ids"], Kind.REVIEW_DECISION),
            (review["participant_ids"], Kind.REVIEW_DECISION),
        ),
        actor_id=actor_id,
        project_id=review["project_id"],
        target_type=TargetType.REVIEW,
        target_id=review_id,
        data={"to_status": decision},
    )


class StatusChangedHandler(_Handler):
    """
    A task's or a version's status changed: the task's assignee; the version's artist and task's
    assignee. A review reached a decision: see ``_review_decision``.
    """

    def notify(self, payload):
        entity_type = payload.get("entity_type")
        if entity_type == "Review":
            _review_decision(
                payload["entity_id"], payload.get("to_status"), payload.get("actor_id")
            )
            return
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


class ReviewDecidedHandler(_Handler):
    """The supervisor's verdict decided a review without moving its status: as a decision."""

    def notify(self, payload):
        _review_decision(payload["review_id"], payload.get("decision"), payload.get("actor_id"))


class ReviewParticipantAddedHandler(_Handler):
    """Someone was asked for a verdict: that person."""

    def notify(self, payload):
        FanoutService.notify(
            kinds=merge(([payload.get("user_id")], Kind.REVIEW_INVITED)),
            actor_id=payload.get("actor_id"),
            project_id=payload["project_id"],
            target_type=TargetType.REVIEW,
            target_id=payload["review_id"],
        )


class ReviewParticipantVerdictHandler(_Handler):
    """A participant gave a verdict (not ``Pending Review``): the lead reviewer and the review's creator."""

    def notify(self, payload):
        verdict = payload.get("verdict")
        if not verdict or verdict == "Pending Review":
            return
        review = NotificationSources.review(payload["review_id"])
        if review is None:
            return
        FanoutService.notify(
            kinds=merge(
                ([review["lead_reviewer_id"], review["created_by_id"]], Kind.REVIEW_VERDICT)
            ),
            actor_id=payload.get("actor_id"),
            project_id=review["project_id"],
            target_type=TargetType.REVIEW,
            target_id=payload["review_id"],
            data={"verdict": verdict},
        )


class ReviewCommentAddedHandler(_Handler):
    """
    A comment on a version of a review: that version's artist and the assignee of its task. A reply: the
    thread's author, everyone who replied earlier, and the same people of the thread's version. A comment
    that is not client-visible is told to no client member (C-RP-29).
    """

    def notify(self, payload):
        thread = NotificationSources.review_thread(payload["comment_id"])
        if thread is None:
            return
        involved = list(thread["version_artist_ids"])
        if payload.get("parent_id"):
            involved = [thread["author_id"], *thread["reply_author_ids"], *involved]
        kinds = merge((involved, Kind.REVIEW_COMMENT))
        if not payload.get("is_client_visible"):
            hidden = NotificationSources.client_members(payload["project_id"], list(kinds))
            kinds = {user_id: kind for user_id, kind in kinds.items() if user_id not in hidden}
        FanoutService.notify(
            kinds=kinds,
            actor_id=payload.get("author_id"),
            project_id=payload["project_id"],
            target_type=TargetType.REVIEW,
            target_id=payload["review_id"],
            data={"version_id": payload.get("version_id")},
        )


# ---------------------------------------------------------------------- RP-13 (C-RP-35)

#: a delivery arriving here is a step someone waits for (Q-RP-59)
DELIVERY_ARRIVALS = frozenset(
    {
        delivery_flow.SIGNED_OFF,
        delivery_flow.SUBMITTED,
        delivery_flow.APPROVED,
        delivery_flow.REJECTED,
        delivery_flow.COMPLETE,
        delivery_flow.CANCELLED,
    }
)
#: leaving these (a reopen, a correction) is the surprise worth telling (Q-RP-59)
DELIVERY_DEPARTURES = frozenset({delivery_flow.SIGNED_OFF}) | delivery_flow.SENT_STATES


class DeliveryStatusChangedHandler(_Handler):
    """
    A delivery moved: its people (creator, whoever signed it off, whoever sent it), when it arrived
    at a step someone waits for or left Signed Off or a sent status. Recording the client's answer
    is told as ``delivery_client_answer`` instead. A move in the working states tells nobody.
    """

    def notify(self, payload):
        source, target = payload.get("from_status"), payload.get("to_status")
        client_status = payload.get("client_status") or ""
        if client_status and source == delivery_flow.SUBMITTED:
            kind, data = Kind.DELIVERY_CLIENT_ANSWER, {"client_status": client_status}
        elif target in DELIVERY_ARRIVALS or source in DELIVERY_DEPARTURES:
            kind, data = Kind.DELIVERY_STATUS, {"from_status": source, "to_status": target}
        else:
            return
        delivery = DeliveryNotificationSources.delivery(payload["delivery_id"])
        if delivery is None:
            return
        FanoutService.notify(
            kinds=merge((delivery["people"], kind)),
            actor_id=None if payload.get("system") else payload.get("actor_id"),
            project_id=delivery["project_id"],
            target_type=TargetType.DELIVERY,
            target_id=payload["delivery_id"],
            data=data,
        )


class PublishJobFinishedHandler(_Handler):
    """A publish job ended Exported or Failed: its creator, the version's artist and the assignee of its task."""

    def notify(self, payload):
        job = PublishingNotificationSources.job(payload["job_id"])
        if job is None:
            return
        involved = [job["created_by_id"]]
        version = NotificationSources.version(job["version_id"]) if job["version_id"] else None
        if version is not None:
            involved += [version["artist_id"], version["task_assignee_id"]]
        FanoutService.notify(
            kinds=merge((involved, Kind.PUBLISH_FINISHED)),
            actor_id=payload.get("actor_id"),
            project_id=job["project_id"],
            target_type=TargetType.PUBLISH_JOB,
            target_id=payload["job_id"],
            data={"status": payload.get("status")},
        )


class PublishedFileRevokedHandler(_Handler):
    """
    A published file was revoked: its creator, the creators of the files built from it, and the
    people (creator, whoever signed it off) of every unsent delivery holding its version.
    """

    def notify(self, payload):
        found = PublishingNotificationSources.file(payload["file_id"])
        if found is None:
            return
        involved = [
            found["created_by_id"],
            *found["downstream_creator_ids"],
            *DeliveryNotificationSources.unsent_people(found["version_id"]),
        ]
        FanoutService.notify(
            kinds=merge((involved, Kind.PUBLISHED_FILE_REVOKED)),
            actor_id=payload.get("actor_id"),
            project_id=found["project_id"],
            target_type=TargetType.PUBLISHED_FILE,
            target_id=payload["file_id"],
        )


class MilestoneCompletedHandler(_Handler):
    """A milestone was completed by someone other than its creator: its creator."""

    def notify(self, payload):
        milestone = ScheduleNotificationSources.milestone(payload["milestone_id"])
        if milestone is None:
            return
        FanoutService.notify(
            kinds=merge(([milestone["created_by_id"]], Kind.MILESTONE_COMPLETED)),
            actor_id=payload.get("actor_id"),
            project_id=milestone["project_id"],
            target_type=TargetType.MILESTONE,
            target_id=payload["milestone_id"],
        )
