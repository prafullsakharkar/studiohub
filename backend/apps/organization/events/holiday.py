from apps.core.events import BaseEvent


class HolidayCreated(BaseEvent):
    event_type = "organization.holiday.created"


class HolidayUpdated(BaseEvent):
    event_type = "organization.holiday.updated"


class HolidayArchived(BaseEvent):
    event_type = "organization.holiday.archived"


class HolidayActivated(BaseEvent):
    event_type = "organization.holiday.activated"


class HolidayDeactivated(BaseEvent):
    event_type = "organization.holiday.deactivated"


class HolidayRestored(BaseEvent):
    event_type = "organization.holiday.restored"


class HolidayDeleted(BaseEvent):
    event_type = "organization.holiday.deleted"
