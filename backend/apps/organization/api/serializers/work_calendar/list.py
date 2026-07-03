from .base import (
    WorkCalendarBaseSerializer,
)


class WorkCalendarListSerializer(
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
            "organization",
            "timezone",
            "is_default",
            "status",
        )
