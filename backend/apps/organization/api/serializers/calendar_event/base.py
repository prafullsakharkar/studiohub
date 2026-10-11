from typing import Any

from apps.organization.api.serializers.base import (
    OrganizationEntitySerializer,
)
from apps.organization.models import CalendarEvent


class CalendarEventBaseSerializer(
    OrganizationEntitySerializer[Any],
):
    class Meta(OrganizationEntitySerializer.Meta):
        model = CalendarEvent

        fields = (
            "id",
            "uuid",
            "organization",
            "code",
            "name",
            "description",
            "date",
            "event_type",
            "office_name",
            "all_day",
            "created_at",
            "updated_at",
        )
