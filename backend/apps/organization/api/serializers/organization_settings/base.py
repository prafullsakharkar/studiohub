from apps.organization.api.serializers.base import (
    OrganizationEntitySerializer,
)
from apps.organization.models import (
    OrganizationSettings,
)


class OrganizationSettingsBaseSerializer(
    OrganizationEntitySerializer,
):
    """
    Base serializer for Organization Settings.
    """

    class Meta(OrganizationEntitySerializer.Meta):
        model = OrganizationSettings

        fields = (
            *OrganizationEntitySerializer.Meta.fields,
            "timezone",
            "language",
            "currency",
            "date_format",
            "time_format",
            "week_start",
            "fiscal_year_start",
            "allow_remote_work",
            "allow_overtime",
        )
