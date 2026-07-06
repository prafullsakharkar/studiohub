from .base import PositionBaseSerializer


class PositionSummarySerializer(
    PositionBaseSerializer,
):

    class Meta(
        PositionBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "status",
        )
