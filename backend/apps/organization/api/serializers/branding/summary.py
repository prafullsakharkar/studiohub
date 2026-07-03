from .base import BrandingBaseSerializer


class BrandingSummarySerializer(
    BrandingBaseSerializer,
):
    class Meta(BrandingBaseSerializer.Meta):
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "theme",
            "status",
        )
