from typing import Any

from apps.core.api.serializers import BaseWriteSerializer
from apps.organization.models import Department


class DepartmentCreateSerializer(
    BaseWriteSerializer[Any],
):

    class Meta:
        model = Department

        # `id` is read-only (server-set) but must be returned on create so the
        # frontend can navigate to the new department.
        exclude = (
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "deleted_at",
        )

        read_only_fields = ("id", "uuid")
