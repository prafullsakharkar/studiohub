from apps.core.events import BaseEvent


class OfficeCreated(BaseEvent):
    event_type = "organization.office.created"


class OfficeUpdated(BaseEvent):
    event_type = "organization.office.updated"


class OfficeArchived(BaseEvent):
    event_type = "organization.office.archived"


class OfficeActivated(BaseEvent):
    event_type = "organization.office.activated"


class OfficeDeactivated(BaseEvent):
    event_type = "organization.office.deactivated"


class OfficeRestored(BaseEvent):
    event_type = "organization.office.restored"


class OfficeDeleted(BaseEvent):
    event_type = "organization.office.deleted"


class OfficeManagerAssigned(BaseEvent):
    event_type = "organization.office.manager_assigned"


class OfficeHeadquartersChanged(BaseEvent):
    event_type = "organization.office.headquarters_changed"
