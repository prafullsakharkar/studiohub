from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Task


class TaskUpdateSerializer(BaseWriteSerializer):
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
