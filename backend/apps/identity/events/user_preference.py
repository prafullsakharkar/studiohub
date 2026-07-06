from apps.core.events import BaseEvent


class UserPreferenceCreated(BaseEvent):
    event_type = "identity.user_preference.created"


class UserPreferenceUpdated(BaseEvent):
    event_type = "identity.user_preference.updated"


class UserPreferenceArchived(BaseEvent):
    event_type = "identity.user_preference.archived"


class UserPreferenceActivated(BaseEvent):
    event_type = "identity.user_preference.activated"


class UserPreferenceDeactivated(BaseEvent):
    event_type = "identity.user_preference.deactivated"


class UserPreferenceRestored(BaseEvent):
    event_type = "identity.user_preference.restored"


class UserPreferenceDeleted(BaseEvent):
    event_type = "identity.user_preference.deleted"
