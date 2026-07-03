from apps.core.events import BaseEvent


class DepartmentCreated(BaseEvent):
    event_type = "organization.department.created"


class DepartmentUpdated(BaseEvent):
    event_type = "organization.department.updated"


class DepartmentArchived(BaseEvent):
    event_type = "organization.department.archived"


class DepartmentDeleted(BaseEvent):
    event_type = "organization.department.deleted"


class DepartmentManagerAssigned(BaseEvent):
    event_type = "organization.department.manager_assigned"


class DepartmentMoved(BaseEvent):
    event_type = "organization.department.moved"


class DepartmentRestored(BaseEvent):
    event_type = "organization.department.restored"


class DepartmentActivated(BaseEvent):
    event_type = "organization.department.activated"


class DepartmentDeactivated(BaseEvent):
    event_type = "organization.department.deactivated"
