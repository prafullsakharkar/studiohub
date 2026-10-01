"""
Department serializer base classes.
"""

from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.organization.models import Department


class DepartmentSerializer(BaseReadSerializer[Any]):

    head_id = serializers.UUIDField(read_only=True, allow_null=True, source="manager_id")
    head_name = serializers.SerializerMethodField()

    def get_head_name(self, obj):
        mgr = getattr(obj, "manager", None)
        return mgr.name if mgr else ""

    class Meta:
        model = Department
        fields = "__all__"
