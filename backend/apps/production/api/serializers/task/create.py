from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import (
    LenientUniqueTogetherValidator,
    ProjectReferenceMixin,
)
from apps.production.models import Task


class TaskCreateSerializer(ProjectReferenceMixin, BaseWriteSerializer[Any]):
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
            "logged_hours",
        )
        read_only_fields = ("id", "uuid")
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
