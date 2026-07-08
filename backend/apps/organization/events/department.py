from apps.core.events import DomainEvent


class DepartmentCreated(DomainEvent):
    event_type = "organization.department.created"


class DepartmentUpdated(DomainEvent):
    event_type = "organization.department.updated"


class DepartmentArchived(DomainEvent):
    event_type = "organization.department.archived"


class DepartmentDeleted(DomainEvent):
    event_type = "organization.department.deleted"


class DepartmentManagerAssigned(DomainEvent):
    event_type = "organization.department.manager_assigned"


class DepartmentMoved(DomainEvent):
    event_type = "organization.department.moved"


class DepartmentRestored(DomainEvent):
    event_type = "organization.department.restored"


class DepartmentActivated(DomainEvent):
    event_type = "organization.department.activated"


class DepartmentDeactivated(DomainEvent):
    event_type = "organization.department.deactivated"
