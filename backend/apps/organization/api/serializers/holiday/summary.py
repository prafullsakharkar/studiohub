from .base import HolidaySerializer


class HolidaySummarySerializer(
    HolidaySerializer,
):
    class Meta(
        HolidaySerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "date",
        )
