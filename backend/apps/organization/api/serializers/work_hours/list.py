from .base import WorkHoursBaseSerializer


class WorkHoursListSerializer(
    WorkHoursBaseSerializer,
):

    class Meta(
        WorkHoursBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "organization",
            "work_calendar",
            "day",
            "start_time",
            "end_time",
            "is_working_day",
            "status",
        )
