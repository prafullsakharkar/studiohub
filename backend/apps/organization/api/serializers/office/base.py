from apps.organization.api.serializers.base import (
    OrganizationEntitySerializer,
)
from apps.organization.models.office import Office


class OfficeBaseSerializer(
    OrganizationEntitySerializer,
):
    class Meta(OrganizationEntitySerializer.Meta):
        model = Office

        fields = (
            *OrganizationEntitySerializer.Meta.fields,
            "office_type",
            "timezone",
            "country",
            "state",
            "city",
            "address_line_1",
            "address_line_2",
            "postal_code",
            "phone",
            "email",
            "manager",
            "capacity",
            "is_headquarters",
        )
