from apps.organization.api.serializers.base import (
    OrganizationEntitySerializer,
)
from apps.organization.models.calendar import (
    Calendar,
)


class CalendarBaseSerializer(
    OrganizationEntitySerializer,
):

    class Meta(
        OrganizationEntitySerializer.Meta,
    ):
        model = Calendar

        fields = (
            *OrganizationEntitySerializer.Meta.fields,
            "description",
            "color",
            "is_default",
            "is_public",
        )
