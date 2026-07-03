from apps.core.services.business import BusinessService
from apps.organization.events import (
    HolidayActivated,
    HolidayArchived,
    HolidayCreated,
    HolidayDeactivated,
    HolidayDeleted,
    HolidayRestored,
    HolidayUpdated,
)
from apps.organization.models import Holiday
from apps.organization.validators.holiday import HolidayValidator


class HolidayService(BusinessService):

    model = Holiday

    validator_class = HolidayValidator

    event_map = {
        "create": HolidayCreated,
        "update": HolidayUpdated,
        "delete": HolidayDeleted,
        "restore": HolidayRestored,
        "archive": HolidayArchived,
        "activate": HolidayActivated,
        "deactivate": HolidayDeactivated,
    }
