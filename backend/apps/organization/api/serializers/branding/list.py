from .base import BrandingBaseSerializer


class BrandingListSerializer(
    BrandingBaseSerializer,
):
    class Meta(BrandingBaseSerializer.Meta):
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "organization",
            "theme",
            "primary_color",
            "status",
        )
