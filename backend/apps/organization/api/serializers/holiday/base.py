from typing import Any

from apps.organization.api.serializers.base import (
    OrganizationEntitySerializer,
)
from apps.organization.models import Holiday


class HolidaySerializer(
    OrganizationEntitySerializer[Any],
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

        # NOTE: work_calendar/date/holiday_type/is_paid/is_recurring must
        # stay writable — the create endpoint depends on them (read-only
        # here previously forced null work_calendar → IntegrityError/409).
