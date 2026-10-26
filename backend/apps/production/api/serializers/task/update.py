from typing import Any

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import LockedFieldsMixin
from apps.production.models import Task


class TaskUpdateSerializer(LockedFieldsMixin, BaseWriteSerializer[Any]):
    locked_fields = {
        "is_archived": "Use the archive and restore actions.",
        "logged_hours": "Derived from the task's timelogs.",
    }

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
        )
        read_only_fields = ("is_archived", "logged_hours")
