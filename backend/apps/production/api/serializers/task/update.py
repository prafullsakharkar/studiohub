from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import LockedFieldsMixin, NormalizedCodeMixin
from apps.production.api.serializers.task.hours import TaskHoursMixin
from apps.production.models import Task


class TaskUpdateSerializer(  # pyright: ignore[reportUnsafeMultipleInheritance]
    TaskHoursMixin, NormalizedCodeMixin, LockedFieldsMixin, BaseWriteSerializer[Any]
):
    locked_fields = {
        "is_archived": "Use the archive and restore actions.",
        "logged_hours": "Derived from the task's timelogs.",
    }

    is_archived = serializers.BooleanField(source="is_deleted", read_only=True)

    class Meta:
        model = Task
        fields = (
            "title",
            "code",
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
            "logged_hours",
            "pending_hours",
        )
        read_only_fields = ("is_archived", "logged_hours")
