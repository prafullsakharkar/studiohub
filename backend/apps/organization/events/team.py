from apps.core.events import DomainEvent


class TeamCreated(DomainEvent):
    event_type = "organization.team.created"


class TeamUpdated(DomainEvent):
    event_type = "organization.team.updated"


class TeamArchived(DomainEvent):
    event_type = "organization.team.archived"


class TeamDeleted(DomainEvent):
    event_type = "organization.team.deleted"


class TeamLeadAssigned(DomainEvent):
    event_type = "organization.team.lead_assigned"


class TeamDepartmentChanged(DomainEvent):
    event_type = "organization.team.department_changed"


class TeamMoved(DomainEvent):
    event_type = "organization.team.moved"


class TeamRestored(DomainEvent):
    event_type = "organization.team.restored"


class TeamActivated(DomainEvent):
    event_type = "organization.team.activated"


class TeamDeactivated(DomainEvent):
    event_type = "organization.team.deactivated"
