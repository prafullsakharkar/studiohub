from apps.core.events import DomainEvent


class OrganizationSettingsCreated(DomainEvent):
    event_type = "organization.settings.created"


class OrganizationSettingsUpdated(DomainEvent):
    event_type = "organization.settings.updated"


class OrganizationSettingsDeleted(DomainEvent):
    event_type = "organization.settings.deleted"


class OrganizationSettingsRestored(DomainEvent):
    event_type = "organization.settings.restored"


class OrganizationSettingsArchived(DomainEvent):
    event_type = "organization.settings.archived"


class OrganizationSettingsActivated(DomainEvent):
    event_type = "organization.settings.activated"


class OrganizationSettingsDeactivated(DomainEvent):
    event_type = "organization.settings.deactivated"
