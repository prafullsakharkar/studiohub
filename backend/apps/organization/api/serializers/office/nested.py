from .base import OfficeBaseSerializer


class OfficeNestedSerializer(
    OfficeBaseSerializer,
):

    class Meta(OfficeBaseSerializer.Meta):

        fields = (
            "uuid",
            "code",
            "name",
            "city",
            "country",
        )
