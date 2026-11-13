"""The inbox shapes (docs/review-pipeline RP-6, C-RP-23)."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.notifications.constants import Kind
from apps.notifications.models import Notification


def _display_name(user) -> str:
    if user is None:
        return ""
    profile = getattr(user, "profile", None)
    if profile is not None and getattr(profile, "display_name", None):
        return profile.display_name
    return getattr(user, "email", "") or ""


class NotificationSerializer(serializers.ModelSerializer[Notification]):
    """
    One row. ``target`` and ``project`` are read from the live records of the page
    (``context["labels"]``, see ``InboxSelector.page_labels``); a row read alone reads its own.
    """

    actor = serializers.SerializerMethodField()
    project = serializers.SerializerMethodField()
    target = serializers.SerializerMethodField()
    record = serializers.SerializerMethodField()
    # The contract's key is ``data``; DRF's metaclass moves declared fields off the class, so this does
    # not hide ``Serializer.data`` at run time (the checker only sees the class body).
    data = serializers.SerializerMethodField()  # pyright: ignore[reportIncompatibleMethodOverride, reportAssignmentType]

    class Meta:
        model = Notification
        fields = (
            "id",
            "kind",
            "created_at",
            "read_at",
            "actor",
            "project",
            "target",
            "record",
            "data",
        )
        read_only_fields = fields

    def _labels(self, obj) -> dict[str, Any]:
        labels = self.context.get("labels")
        if labels is None:
            from apps.notifications.selectors.inbox import InboxSelector

            labels = InboxSelector.page_labels([obj])
        return labels

    def _target_label(self, obj) -> dict[str, Any]:
        found = self._labels(obj)["targets"].get(obj.target_type, {})
        return found.get(str(obj.target_id)) or {"code": "", "name": "", "record": None}

    def get_actor(self, obj) -> dict[str, str] | None:
        if obj.actor_id is None:
            return None
        return {"id": str(obj.actor_id), "name": _display_name(obj.actor)}

    def get_project(self, obj) -> dict[str, str]:
        found = self._labels(obj)["projects"].get(str(obj.project_id))
        return found or {"id": str(obj.project_id), "code": "", "name": ""}

    def get_target(self, obj) -> dict[str, str]:
        label = self._target_label(obj)
        return {
            "type": obj.target_type,
            "id": str(obj.target_id),
            "code": label["code"],
            "name": label["name"],
        }

    def get_record(self, obj) -> dict[str, str] | None:
        return self._target_label(obj)["record"]

    def get_data(self, obj) -> dict[str, Any]:
        stored = obj.data or {}
        if obj.kind in (Kind.NOTE_STATUS, Kind.TASK_STATUS, Kind.VERSION_STATUS):
            return {"from_status": stored.get("from_status"), "to_status": stored.get("to_status")}
        if obj.kind == Kind.REVIEW_MEDIA_FAILED:
            return {"error_code": stored.get("error_code") or ""}
        return {}


class UnreadCountSerializer(serializers.Serializer[Any]):
    count = serializers.IntegerField()


class ReadAllSerializer(serializers.Serializer[Any]):
    before = serializers.DateTimeField(required=False, allow_null=True)


class ReadAllResultSerializer(serializers.Serializer[Any]):
    updated = serializers.IntegerField()
