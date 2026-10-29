"""Task templates: what they look like going out, and what a write may contain (D-27)."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from rest_framework import serializers

from apps.production.api.serializers.actions import StrictSerializer
from apps.production.models import TaskTemplate, TaskTemplateItem
from apps.production.services.task_template import TaskTemplateService

ENTITY_TYPES = ("Shot", "Asset")


class TaskTemplateItemSerializer(serializers.ModelSerializer[Any]):
    task_type_id = serializers.UUIDField(read_only=True)
    task_type_code = serializers.CharField(source="task_type.code", read_only=True)
    task_type_name = serializers.CharField(source="task_type.name", read_only=True)
    department_name = serializers.CharField(source="task_type.department_name", read_only=True)

    class Meta:
        model = TaskTemplateItem
        fields = (
            "id",
            "task_type_id",
            "task_type_code",
            "task_type_name",
            "department_name",
            "name",
            "order",
            "default_bid_hours",
        )
        read_only_fields = fields


class TaskTemplateSerializer(serializers.ModelSerializer[Any]):
    project_id = serializers.UUIDField(read_only=True, allow_null=True)
    project_code = serializers.CharField(source="project.code", read_only=True, default="")
    scope = serializers.SerializerMethodField()
    items = TaskTemplateItemSerializer(many=True, read_only=True)

    class Meta:
        model = TaskTemplate
        fields = (
            "id",
            "project_id",
            "project_code",
            "scope",
            "name",
            "description",
            "entity_type",
            "is_active",
            "items",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_scope(self, obj) -> str:
        return "studio" if obj.project_id is None else "project"


class TemplateItemInputSerializer(StrictSerializer):
    """One task of a template: a catalog task type (id or code), a name, a bid."""

    task_type_id = serializers.CharField(max_length=100)
    name = serializers.CharField(max_length=255)
    order = serializers.IntegerField(min_value=0, required=False)
    default_bid_hours = serializers.DecimalField(
        max_digits=6, decimal_places=2, min_value=0, required=False, default=Decimal(0)
    )

    def validate(self, attrs):
        task_type = TaskTemplateService.resolve_task_type(attrs.pop("task_type_id"))
        if task_type is None:
            raise serializers.ValidationError({"task_type_id": ["Unknown task type."]})
        attrs["task_type"] = task_type
        attrs["name"] = attrs["name"].strip()
        if not attrs["name"]:
            raise serializers.ValidationError({"name": ["This field may not be blank."]})
        return attrs


class TaskTemplateCreateSerializer(StrictSerializer):
    project_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(allow_blank=True, default="")
    entity_type = serializers.ChoiceField(choices=ENTITY_TYPES, default="Shot")
    is_active = serializers.BooleanField(default=True)
    items = TemplateItemInputSerializer(many=True, required=False, default=list)

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value


class TaskTemplateUpdateSerializer(StrictSerializer):
    """Everything but the project; ``items``, when sent, replaces the whole list."""

    name = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(allow_blank=True, required=False)
    entity_type = serializers.ChoiceField(choices=ENTITY_TYPES, required=False)
    is_active = serializers.BooleanField(required=False)
    items = TemplateItemInputSerializer(many=True, required=False)

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value


class ApplyTemplateSerializer(StrictSerializer):
    """Body of ``POST /task-templates/{id}/apply/``."""

    project_id = serializers.CharField(required=False, allow_blank=True)
    entity_id = serializers.CharField(max_length=100)


class CopyTemplateSerializer(StrictSerializer):
    """Body of ``POST /task-templates/{id}/copy-to-project/``."""

    project_id = serializers.CharField(max_length=100)
    name = serializers.CharField(max_length=255, required=False)
