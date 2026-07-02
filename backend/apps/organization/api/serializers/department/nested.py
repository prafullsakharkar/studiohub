from apps.core.api.serializers import BaseNestedSerializer
from apps.organization.models import Department


class DepartmentNestedSerializer(
    BaseNestedSerializer,
):

    class Meta:
        model = Department

        fields = (
            "id",
            "uuid",
            "name",
        )
