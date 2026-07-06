from apps.core.services.business import BusinessService
from apps.organization.events import (
    WorkHoursActivated,
    WorkHoursArchived,
    WorkHoursCreated,
    WorkHoursDeactivated,
    WorkHoursDeleted,
    WorkHoursRestored,
    WorkHoursUpdated,
)
from apps.organization.models import WorkHours
from apps.organization.validators.work_hours import (
    WorkHoursValidator,
)


class WorkHoursService(
    BusinessService,
):

    model = WorkHours

    validator_class = WorkHoursValidator

    event_map = {
        "create": WorkHoursCreated,
        "update": WorkHoursUpdated,
        "delete": WorkHoursDeleted,
        "restore": WorkHoursRestored,
        "archive": WorkHoursArchived,
        "activate": WorkHoursActivated,
        "deactivate": WorkHoursDeactivated,
    }
