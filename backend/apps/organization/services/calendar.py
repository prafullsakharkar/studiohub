from apps.core.services.business import BusinessService
from apps.organization.events import (
    CalendarActivated,
    CalendarArchived,
    CalendarCreated,
    CalendarDeactivated,
    CalendarDeleted,
    CalendarRestored,
    CalendarUpdated,
)
from apps.organization.models import Calendar
from apps.organization.validators.calendar import (
    CalendarValidator,
)


class CalendarService(
    BusinessService,
):

    model = Calendar

    validator_class = CalendarValidator

    event_map = {
        "create": CalendarCreated,
        "update": CalendarUpdated,
        "delete": CalendarDeleted,
        "restore": CalendarRestored,
        "archive": CalendarArchived,
        "activate": CalendarActivated,
        "deactivate": CalendarDeactivated,
    }
