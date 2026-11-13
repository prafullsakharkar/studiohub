"""Kinds and target types of an in-app notification (docs/review-pipeline RP-6, C-RP-23)."""

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


class TargetType(models.TextChoices):
    NOTE = "note", "Note thread"
    TASK = "task", "Task"
    VERSION = "version", "Version"


#: when one event matches a person in several ways, the kind kept (C-RP-24): a mention wins
KIND_PRIORITY = (Kind.NOTE_MENTION,)

#: rows kept this many days unless ``NOTIFICATIONS_RETENTION_DAYS`` says otherwise (Q-RP-38)
DEFAULT_RETENTION_DAYS = 90
