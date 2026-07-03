from .base import HolidayBaseSerializer


class HolidaySummarySerializer(
    HolidayBaseSerializer,
):
    class Meta(
        HolidayBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "date",
            "status",
        )
