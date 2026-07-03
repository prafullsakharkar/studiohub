from apps.core.events import BaseEvent


class WorkCalendarCreated(BaseEvent):
    event_type = "organization.work_calendar.created"


class WorkCalendarUpdated(BaseEvent):
    event_type = "organization.work_calendar.updated"


class WorkCalendarArchived(BaseEvent):
    event_type = "organization.work_calendar.archived"


class WorkCalendarActivated(BaseEvent):
    event_type = "organization.work_calendar.activated"


class WorkCalendarDeactivated(BaseEvent):
    event_type = "organization.work_calendar.deactivated"


class WorkCalendarRestored(BaseEvent):
    event_type = "organization.work_calendar.restored"


class WorkCalendarDeleted(BaseEvent):
    event_type = "organization.work_calendar.deleted"


class WorkCalendarDefaultChanged(BaseEvent):
    event_type = "organization.work_calendar.default_changed"
