from typing import Any

from apps.core.api.serializers import BaseWriteSerializer
from apps.organization.models import Department


class DepartmentCreateSerializer(
    BaseWriteSerializer[Any],
):

    class Meta:
        model = Department

        exclude = (
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "deleted_at",
        )
