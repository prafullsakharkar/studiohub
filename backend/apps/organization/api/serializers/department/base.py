"""
Department serializer base classes.
"""

from apps.core.api.serializers.base import BaseReadSerializer
from apps.organization.models import Department


class DepartmentSerializer(BaseReadSerializer):

    class Meta:
        model = Department
        fields = "__all__"
