from apps.organization.api.serializers.base import (
    OrganizationEntitySerializer,
)
from apps.organization.models.work_calendar import (
    WorkCalendar,
)


class WorkCalendarBaseSerializer(
    OrganizationEntitySerializer,
):

    class Meta(
        OrganizationEntitySerializer.Meta,
    ):
        model = WorkCalendar

        fields = (
            *OrganizationEntitySerializer.Meta.fields,
            "timezone",
            "working_days",
            "is_default",
        )
