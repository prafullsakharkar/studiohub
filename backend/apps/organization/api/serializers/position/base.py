from apps.organization.api.serializers.base import (
    OrganizationEntitySerializer,
)
from apps.organization.models.position import (
    Position,
)


class PositionBaseSerializer(
    OrganizationEntitySerializer,
):

    class Meta(
        OrganizationEntitySerializer.Meta,
    ):
        model = Position

        fields = (
            *OrganizationEntitySerializer.Meta.fields,
            "department",
            "parent",
            "level",
            "is_managerial",
        )
