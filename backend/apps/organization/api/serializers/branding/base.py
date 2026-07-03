from apps.organization.api.serializers.base import (
    OrganizationEntitySerializer,
)
from apps.organization.models import Branding


class BrandingBaseSerializer(
    OrganizationEntitySerializer,
):
    """
    Base serializer for Branding.
    """

    class Meta(OrganizationEntitySerializer.Meta):
        model = Branding

        fields = (
            *OrganizationEntitySerializer.Meta.fields,
            "logo",
            "favicon",
            "primary_color",
            "secondary_color",
            "accent_color",
            "font_family",
            "theme",
        )
