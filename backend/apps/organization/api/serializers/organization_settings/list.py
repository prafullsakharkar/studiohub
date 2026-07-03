from .base import (
    OrganizationSettingsBaseSerializer,
)


class OrganizationSettingsListSerializer(
    OrganizationSettingsBaseSerializer,
):
    """
    List serializer.
    """

    class Meta(
        OrganizationSettingsBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "organization",
            "timezone",
            "language",
            "currency",
            "status",
        )
