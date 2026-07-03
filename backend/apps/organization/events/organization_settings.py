from apps.core.events import BaseEvent


class OrganizationSettingsCreated(BaseEvent):
    event_type = "organization.settings.created"


class OrganizationSettingsUpdated(BaseEvent):
    event_type = "organization.settings.updated"


class OrganizationSettingsDeleted(BaseEvent):
    event_type = "organization.settings.deleted"


class OrganizationSettingsRestored(BaseEvent):
    event_type = "organization.settings.restored"


class OrganizationSettingsArchived(BaseEvent):
    event_type = "organization.settings.archived"


class OrganizationSettingsActivated(BaseEvent):
    event_type = "organization.settings.activated"


class OrganizationSettingsDeactivated(BaseEvent):
    event_type = "organization.settings.deactivated"
