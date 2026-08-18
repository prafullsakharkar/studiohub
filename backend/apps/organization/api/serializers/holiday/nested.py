from .base import HolidaySerializer
from .summary import HolidaySummarySerializer


class HolidayNestedSerializer(
    HolidaySummarySerializer,
):
    class Meta(
        HolidaySummarySerializer.Meta,
    ):
        fields = (
            *HolidaySummarySerializer.Meta.fields,
            "work_calendar",
            "date",
            "holiday_type",
            "is_paid",
            "is_recurring",
        )

    pass
