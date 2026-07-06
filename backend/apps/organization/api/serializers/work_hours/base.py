from apps.organization.api.serializers.base import (
    OrganizationEntitySerializer,
)
from apps.organization.models.work_hours import WorkHours


class WorkHoursBaseSerializer(
    OrganizationEntitySerializer,
):

    class Meta(
        OrganizationEntitySerializer.Meta,
    ):
        model = WorkHours

        fields = (
            *OrganizationEntitySerializer.Meta.fields,
            "work_calendar",
            "day",
            "start_time",
            "end_time",
            "break_start",
            "break_end",
            "is_working_day",
        )
