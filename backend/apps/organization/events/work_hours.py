from apps.core.events import BaseEvent


class WorkHoursCreated(BaseEvent):
    event_type = "organization.work_hours.created"


class WorkHoursUpdated(BaseEvent):
    event_type = "organization.work_hours.updated"


class WorkHoursArchived(BaseEvent):
    event_type = "organization.work_hours.archived"


class WorkHoursActivated(BaseEvent):
    event_type = "organization.work_hours.activated"


class WorkHoursDeactivated(BaseEvent):
    event_type = "organization.work_hours.deactivated"


class WorkHoursRestored(BaseEvent):
    event_type = "organization.work_hours.restored"


class WorkHoursDeleted(BaseEvent):
    event_type = "organization.work_hours.deleted"
