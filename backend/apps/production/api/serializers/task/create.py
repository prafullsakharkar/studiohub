from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import (
    LenientUniqueTogetherValidator,
    LockedFieldsMixin,
    NormalizedCodeMixin,
    ProjectReferenceMixin,
)
from apps.production.api.serializers.task.hours import TaskHoursMixin
from apps.production.models import Task


class TaskCreateSerializer(  # pyright: ignore[reportUnsafeMultipleInheritance]
    TaskHoursMixin,
    NormalizedCodeMixin,
    LockedFieldsMixin,
    ProjectReferenceMixin,
    BaseWriteSerializer[Any],
):
    locked_fields = {
        "is_archived": "Use the archive and restore actions.",
        "logged_hours": "Derived from the task's timelogs.",
    }

    is_archived = serializers.BooleanField(source="is_deleted", read_only=True)
    # The pipeline step: an id or code of an active task type in the catalog (resolved by the viewset).
    task_type_id = serializers.CharField(
        source="task_type", write_only=True, required=False, allow_blank=True, allow_null=True
    )

    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = Task
        fields = (
            "id",
            "uuid",
            "title",
            "code",
            "project",
            "project_id",
            "project_code",
            "entity_type",
            "entity_id",
            "entity_code",
            "entity_name",
            "department",
            "department_id",
            "team",
            "assignee",
            "reviewer",
            "vendor_id",
            "vendor_name",
            "vendor_code",
            "workflow",
            "status",
            "priority",
            "schedule",
            "dependencies",
            "description",
            "software",
            "tags",
            "is_archived",
            "due_date",
            "estimated_hours",
            "task_type_id",
            "logged_hours",
            "pending_hours",
        )
        read_only_fields = ("id", "uuid", "is_archived", "logged_hours")
        extra_kwargs = {"project": {"required": False}, "code": {"required": False}}
        validators = [
            LenientUniqueTogetherValidator(
                queryset=Task.objects.all(),
                fields=["project", "code"],
            )
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # Task codes are a required natural key; when the form omits one,
        # derive a stable slug from the title so the UI can post title-only.
        if not str(attrs.get("code") or "").strip():
            import re as _re

            base = _re.sub(r"[^A-Za-z0-9]+", "-", str(attrs.get("title") or "TASK")).strip("-").upper()[:20] or "TASK"
            attrs["code"] = f"{base}-{__import__('uuid').uuid4().hex[:6].upper()}"
        return attrs
