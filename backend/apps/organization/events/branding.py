from apps.core.events import DomainEvent


class BrandingCreated(DomainEvent):
    event_type = "organization.branding.created"


class BrandingUpdated(DomainEvent):
    event_type = "organization.branding.updated"


class BrandingArchived(DomainEvent):
    event_type = "organization.branding.archived"


class BrandingActivated(DomainEvent):
    event_type = "organization.branding.activated"


class BrandingDeactivated(DomainEvent):
    event_type = "organization.branding.deactivated"


class BrandingRestored(DomainEvent):
    event_type = "organization.branding.restored"


class BrandingDeleted(DomainEvent):
    event_type = "organization.branding.deleted"


class BrandingLogoUpdated(DomainEvent):
    event_type = "organization.branding.logo_updated"


class BrandingThemeChanged(DomainEvent):
    event_type = "organization.branding.theme_changed"
