from .base import CalendarBaseSerializer


class CalendarListSerializer(
    CalendarBaseSerializer,
):

    class Meta(
        CalendarBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "organization",
            "color",
            "is_default",
            "is_public",
            "status",
        )
