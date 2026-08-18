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
            "id",
            "uuid",
            "organization",
            "code",
            "name",
            "description",
            "office_type",
            "timezone",
            "country",
            "state",
            "city",
            "address",
            "postal_code",
            "phone",
            "email",
            "manager",
            "is_headquarters",
            "created_at",
            "updated_at",
        )
