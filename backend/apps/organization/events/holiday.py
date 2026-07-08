from apps.core.events import DomainEvent


class HolidayCreated(DomainEvent):
    event_type = "organization.holiday.created"


class HolidayUpdated(DomainEvent):
    event_type = "organization.holiday.updated"


class HolidayArchived(DomainEvent):
    event_type = "organization.holiday.archived"


class HolidayActivated(DomainEvent):
    event_type = "organization.holiday.activated"


class HolidayDeactivated(DomainEvent):
    event_type = "organization.holiday.deactivated"


class HolidayRestored(DomainEvent):
    event_type = "organization.holiday.restored"


class HolidayDeleted(DomainEvent):
    event_type = "organization.holiday.deleted"
