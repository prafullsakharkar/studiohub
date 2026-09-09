
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
            "headquarters",
            "tier",
            "logo_url",
            "crew_count",
            "offices_count",
            "active_projects_count",
            "storage_quota_tb",
            "storage_used_tb",
            "primary_contact_name",
            "primary_contact_email",
        )
