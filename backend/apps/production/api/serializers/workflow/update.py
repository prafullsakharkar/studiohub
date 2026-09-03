from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Workflow


class WorkflowUpdateSerializer(BaseWriteSerializer):
    class Meta:
        model = Workflow
        fields = ("name","code","description","category","is_active","department","nodes","transitions","automation_rules","is_archived")
