from apps.core.events import BaseEvent


class CalendarCreated(BaseEvent):
    event_type = "organization.calendar.created"


class CalendarUpdated(BaseEvent):
    event_type = "organization.calendar.updated"


class CalendarArchived(BaseEvent):
    event_type = "organization.calendar.archived"


class CalendarActivated(BaseEvent):
    event_type = "organization.calendar.activated"


class CalendarDeactivated(BaseEvent):
    event_type = "organization.calendar.deactivated"


class CalendarRestored(BaseEvent):
    event_type = "organization.calendar.restored"


class CalendarDeleted(BaseEvent):
    event_type = "organization.calendar.deleted"


class CalendarDefaultChanged(BaseEvent):
    event_type = "organization.calendar.default_changed"
