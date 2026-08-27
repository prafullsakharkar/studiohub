from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Task


class TaskCreateSerializer(BaseWriteSerializer):
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
        read_only_fields = ("id", "uuid")
