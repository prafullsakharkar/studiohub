from .base import HolidaySerializer


class HolidayListSerializer(
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
            "organization",
            "work_calendar",
            "date",
            "holiday_type",
        )
