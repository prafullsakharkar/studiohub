from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import ProjectReferenceMixin
from apps.production.models import Workflow


class WorkflowCreateSerializer(ProjectReferenceMixin, BaseWriteSerializer[Any]):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    class Meta:
        model = Workflow
        fields = ("id","uuid","project","project_id","project_code","name","code","description","category","is_active","department","nodes","transitions","automation_rules")
        read_only_fields = ("id","uuid")
        extra_kwargs = {"project": {"required": False}}
