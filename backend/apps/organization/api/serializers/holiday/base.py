from apps.organization.api.serializers.base import (
    OrganizationEntitySerializer,
)
from apps.organization.models import Holiday


class HolidayBaseSerializer(
    OrganizationEntitySerializer,
):
    class Meta(
        OrganizationEntitySerializer.Meta,
    ):
        model = Holiday

        fields = (
            *OrganizationEntitySerializer.Meta.fields,
            "work_calendar",
            "date",
            "holiday_type",
            "is_paid",
            "is_recurring",
        )
