from .base import (
    OrganizationSettingsBaseSerializer,
)


class OrganizationSettingsSummarySerializer(
    OrganizationSettingsBaseSerializer,
):
    """
    Summary serializer.
    """

    class Meta(
        OrganizationSettingsBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "name",
            "code",
            "timezone",
            "language",
            "currency",
            "status",
        )
