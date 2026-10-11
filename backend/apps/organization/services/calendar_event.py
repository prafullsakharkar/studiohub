"""
CalendarEvent write service.
"""

from __future__ import annotations

from apps.core.services.business import BusinessService
from apps.organization.events import (
    CalendarEventActivated,
    CalendarEventArchived,
    CalendarEventCreated,
    CalendarEventDeactivated,
    CalendarEventDeleted,
    CalendarEventRestored,
    CalendarEventUpdated,
)
from apps.organization.models import CalendarEvent
from apps.organization.validators.calendar_event import (
    CalendarEventValidator,
)


class CalendarEventService(BusinessService):
    """
    Handles all write operations for CalendarEvent.
    """

    model = CalendarEvent

    validator_class = CalendarEventValidator

    event_map = {
        "create": CalendarEventCreated,
        "update": CalendarEventUpdated,
        "delete": CalendarEventDeleted,
        "restore": CalendarEventRestored,
        "archive": CalendarEventArchived,
        "activate": CalendarEventActivated,
        "deactivate": CalendarEventDeactivated,
    }
