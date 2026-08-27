from rest_framework import serializers
from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.models import Workflow
class WorkflowSerializer(BaseReadSerializer):
    project_id = serializers.UUIDField(read_only=True, allow_null=True)
    class Meta:
        model = Workflow
        fields = ("id","uuid","project_id","name","code","description","category","is_active","department","nodes","transitions","automation_rules","execution_stats","is_archived","created_at","updated_at")
        read_only_fields = ("id","uuid","created_at","updated_at")
