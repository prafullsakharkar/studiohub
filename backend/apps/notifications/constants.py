"""Kinds and target types of an in-app notification (docs/review-pipeline RP-6, C-RP-23; RP-11, C-RP-28)."""

from __future__ import annotations

from django.db import models


class Kind(models.TextChoices):
    NOTE_CREATED = "note_created", "A note on your work"
    NOTE_MENTION = "note_mention", "You were mentioned"
    NOTE_REPLY = "note_reply", "A reply in your thread"
    NOTE_STATUS = "note_status", "A note changed status"
    TASK_ASSIGNED = "task_assigned", "A task was assigned to you"
    TASK_STATUS = "task_status", "Your task changed status"
    VERSION_STATUS = "version_status", "Your version changed status"
    REVIEW_MEDIA_READY = "review_media_ready", "Your review movie is ready"
    REVIEW_MEDIA_FAILED = "review_media_failed", "Your review movie failed"
    REVIEW_DECISION = "review_decision", "A review with your work was decided"
    REVIEW_INVITED = "review_invited", "You were asked for a verdict"
    REVIEW_VERDICT = "review_verdict", "A participant gave a verdict"
    REVIEW_COMMENT = "review_comment", "A comment on your work in a review"


class TargetType(models.TextChoices):
    NOTE = "note", "Note thread"
    TASK = "task", "Task"
    VERSION = "version", "Version"
    REVIEW = "review", "Review"


#: when one event matches a person in several ways, the kind kept (C-RP-24): a mention wins
KIND_PRIORITY = (Kind.NOTE_MENTION,)

#: kinds addressed to a person by name: a request for action, so they cannot be muted (Q-RP-48, C-RP-30)
UNMUTABLE_KINDS = frozenset({Kind.NOTE_MENTION, Kind.REVIEW_INVITED})
#: every kind a person may mute, in the kinds' order
MUTABLE_KINDS = tuple(kind for kind in Kind.values if kind not in UNMUTABLE_KINDS)

#: the review decisions that notify (Q-RP-50); the others are the reviewer's own bookkeeping
REVIEW_DECISIONS = frozenset({"Approved", "Rejected", "Changes Requested", "Retake"})

#: rows kept this many days unless ``NOTIFICATIONS_RETENTION_DAYS`` says otherwise (Q-RP-38)
DEFAULT_RETENTION_DAYS = 90
