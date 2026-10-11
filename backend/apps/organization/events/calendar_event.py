from apps.core.events import DomainEvent


class CalendarEventCreated(DomainEvent):
    event_type = "organization.calendar_event.created"


class CalendarEventUpdated(DomainEvent):
    event_type = "organization.calendar_event.updated"


class CalendarEventArchived(DomainEvent):
    event_type = "organization.calendar_event.archived"


class CalendarEventActivated(DomainEvent):
    event_type = "organization.calendar_event.activated"


class CalendarEventDeactivated(DomainEvent):
    event_type = "organization.calendar_event.deactivated"


class CalendarEventRestored(DomainEvent):
    event_type = "organization.calendar_event.restored"


class CalendarEventDeleted(DomainEvent):
    event_type = "organization.calendar_event.deleted"
