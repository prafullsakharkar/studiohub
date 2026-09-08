"""
Department serializer base classes.
"""

from typing import Any

from apps.core.api.serializers.base import BaseReadSerializer
from apps.organization.models import Department


class DepartmentSerializer(BaseReadSerializer[Any]):

    class Meta:
        model = Department
        fields = "__all__"
