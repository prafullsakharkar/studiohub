from apps.core.events import DomainEvent


class WorkCalendarCreated(DomainEvent):
    event_type = "organization.work_calendar.created"


class WorkCalendarUpdated(DomainEvent):
    event_type = "organization.work_calendar.updated"


class WorkCalendarArchived(DomainEvent):
    event_type = "organization.work_calendar.archived"


class WorkCalendarActivated(DomainEvent):
    event_type = "organization.work_calendar.activated"


class WorkCalendarDeactivated(DomainEvent):
    event_type = "organization.work_calendar.deactivated"


class WorkCalendarRestored(DomainEvent):
    event_type = "organization.work_calendar.restored"


class WorkCalendarDeleted(DomainEvent):
    event_type = "organization.work_calendar.deleted"


class WorkCalendarDefaultChanged(DomainEvent):
    event_type = "organization.work_calendar.default_changed"
