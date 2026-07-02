from .base import OfficeBaseSerializer


class OfficeListSerializer(
    OfficeBaseSerializer,
):

    class Meta(OfficeBaseSerializer.Meta):
        fields = (
            "uuid",
            "code",
            "name",
            "city",
            "country",
            "manager",
            "is_headquarters",
            "status",
        )
