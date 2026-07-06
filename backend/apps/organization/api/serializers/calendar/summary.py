from .base import CalendarBaseSerializer


class CalendarSummarySerializer(
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
            "status",
        )
