from .base import HolidayBaseSerializer


class HolidayListSerializer(
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
            "organization",
            "work_calendar",
            "date",
            "holiday_type",
            "status",
        )
