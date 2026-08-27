from rest_framework import serializers
from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Workflow
class WorkflowCreateSerializer(BaseWriteSerializer):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    class Meta:
        model = Workflow
        fields = ("id","uuid","project","name","code","description","category","is_active","department","nodes","transitions","automation_rules")
        read_only_fields = ("id","uuid")
