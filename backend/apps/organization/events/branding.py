from apps.core.events import BaseEvent


class BrandingCreated(BaseEvent):
    event_type = "organization.branding.created"


class BrandingUpdated(BaseEvent):
    event_type = "organization.branding.updated"


class BrandingArchived(BaseEvent):
    event_type = "organization.branding.archived"


class BrandingActivated(BaseEvent):
    event_type = "organization.branding.activated"


class BrandingDeactivated(BaseEvent):
    event_type = "organization.branding.deactivated"


class BrandingRestored(BaseEvent):
    event_type = "organization.branding.restored"


class BrandingDeleted(BaseEvent):
    event_type = "organization.branding.deleted"


class BrandingLogoUpdated(BaseEvent):
    event_type = "organization.branding.logo_updated"


class BrandingThemeChanged(BaseEvent):
    event_type = "organization.branding.theme_changed"
