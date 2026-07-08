from apps.core.events import DomainEvent


class WorkHoursCreated(DomainEvent):
    event_type = "organization.work_hours.created"


class WorkHoursUpdated(DomainEvent):
    event_type = "organization.work_hours.updated"


class WorkHoursArchived(DomainEvent):
    event_type = "organization.work_hours.archived"


class WorkHoursActivated(DomainEvent):
    event_type = "organization.work_hours.activated"


class WorkHoursDeactivated(DomainEvent):
    event_type = "organization.work_hours.deactivated"


class WorkHoursRestored(DomainEvent):
    event_type = "organization.work_hours.restored"


class WorkHoursDeleted(DomainEvent):
    event_type = "organization.work_hours.deleted"
