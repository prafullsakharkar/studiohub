from apps.core.events import DomainEvent


class UserPreferenceCreated(DomainEvent):
    event_type = "identity.user_preference.created"


class UserPreferenceUpdated(DomainEvent):
    event_type = "identity.user_preference.updated"


class UserPreferenceArchived(DomainEvent):
    event_type = "identity.user_preference.archived"


class UserPreferenceActivated(DomainEvent):
    event_type = "identity.user_preference.activated"


class UserPreferenceDeactivated(DomainEvent):
    event_type = "identity.user_preference.deactivated"


class UserPreferenceRestored(DomainEvent):
    event_type = "identity.user_preference.restored"


class UserPreferenceDeleted(DomainEvent):
    event_type = "identity.user_preference.deleted"
