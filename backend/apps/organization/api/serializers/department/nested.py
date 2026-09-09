from typing import Any

from apps.core.api.serializers import BaseNestedSerializer
from apps.organization.models import Department


class DepartmentNestedSerializer(
    BaseNestedSerializer[Any],
):

    class Meta:
        model = Department

        fields = (
            "id",
            "uuid",
            "name",
        )
