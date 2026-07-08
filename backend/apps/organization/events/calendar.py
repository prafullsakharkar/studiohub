from apps.core.events import DomainEvent


class CalendarCreated(DomainEvent):
    event_type = "organization.calendar.created"


class CalendarUpdated(DomainEvent):
    event_type = "organization.calendar.updated"


class CalendarArchived(DomainEvent):
    event_type = "organization.calendar.archived"


class CalendarActivated(DomainEvent):
    event_type = "organization.calendar.activated"


class CalendarDeactivated(DomainEvent):
    event_type = "organization.calendar.deactivated"


class CalendarRestored(DomainEvent):
    event_type = "organization.calendar.restored"


class CalendarDeleted(DomainEvent):
    event_type = "organization.calendar.deleted"


class CalendarDefaultChanged(DomainEvent):
    event_type = "organization.calendar.default_changed"
