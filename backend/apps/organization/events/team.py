from apps.core.events import BaseEvent


class TeamCreated(BaseEvent):
    event_type = "organization.team.created"


class TeamUpdated(BaseEvent):
    event_type = "organization.team.updated"


class TeamArchived(BaseEvent):
    event_type = "organization.team.archived"


class TeamDeleted(BaseEvent):
    event_type = "organization.team.deleted"


class TeamLeadAssigned(BaseEvent):
    event_type = "organization.team.lead_assigned"


class TeamDepartmentChanged(BaseEvent):
    event_type = "organization.team.department_changed"
