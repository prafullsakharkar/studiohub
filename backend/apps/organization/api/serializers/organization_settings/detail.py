from .base import (
    OrganizationSettingsBaseSerializer,
)


class OrganizationSettingsDetailSerializer(
    OrganizationSettingsBaseSerializer,
):
    """
    Detail serializer.
    """

    class Meta(
        OrganizationSettingsBaseSerializer.Meta,
    ):
        pass
