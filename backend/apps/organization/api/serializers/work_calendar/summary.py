from .base import (
    WorkCalendarBaseSerializer,
)


class WorkCalendarSummarySerializer(
    WorkCalendarBaseSerializer,
):

    class Meta(
        WorkCalendarBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "status",
        )
