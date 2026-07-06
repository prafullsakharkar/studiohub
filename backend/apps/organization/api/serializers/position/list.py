from .base import PositionBaseSerializer


class PositionListSerializer(
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
            "organization",
            "department",
            "level",
            "is_managerial",
            "status",
        )
