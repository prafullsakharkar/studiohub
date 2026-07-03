from apps.core.services.business import (
    BusinessService,
)
from apps.organization.events import (
    WorkCalendarActivated,
    WorkCalendarArchived,
    WorkCalendarCreated,
    WorkCalendarDeactivated,
    WorkCalendarDeleted,
    WorkCalendarRestored,
    WorkCalendarUpdated,
)
from apps.organization.models import (
    WorkCalendar,
)
from apps.organization.validators.work_calendar import (
    WorkCalendarValidator,
)


class WorkCalendarService(
    BusinessService,
):

    model = WorkCalendar

    validator_class = WorkCalendarValidator

    event_map = {
        "create": WorkCalendarCreated,
        "update": WorkCalendarUpdated,
        "delete": WorkCalendarDeleted,
        "restore": WorkCalendarRestored,
        "archive": WorkCalendarArchived,
        "activate": WorkCalendarActivated,
        "deactivate": WorkCalendarDeactivated,
    }
