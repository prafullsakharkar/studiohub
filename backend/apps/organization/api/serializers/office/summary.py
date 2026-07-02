from .base import DepartmentSerializer


class DepartmentSummarySerializer(
    DepartmentSerializer,
):

    class Meta(DepartmentSerializer.Meta):

        fields = (
            "id",
            "uuid",
            "name",
            "code",
            "organization_type",
            "status",
            "logo",
        )
