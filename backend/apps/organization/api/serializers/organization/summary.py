from .base import OrganizationSerializer


class OrganizationSummarySerializer(
    OrganizationSerializer,
):

    class Meta(OrganizationSerializer.Meta):

        fields = (
            "id",
            "uuid",
            "name",
            "code",
            "organization_type",
            "status",
            "logo",
        )
