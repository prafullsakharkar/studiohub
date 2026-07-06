from .base import WorkHoursBaseSerializer


class WorkHoursSummarySerializer(
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
            "day",
            "status",
        )
