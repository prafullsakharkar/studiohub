from apps.core.events import BaseEvent


class UserSessionCreated(BaseEvent):
    event_type = "identity.user_session.created"


class UserSessionUpdated(BaseEvent):
    event_type = "identity.user_session.updated"


class UserSessionArchived(BaseEvent):
    event_type = "identity.user_session.archived"


class UserSessionActivated(BaseEvent):
    event_type = "identity.user_session.activated"


class UserSessionDeactivated(BaseEvent):
    event_type = "identity.user_session.deactivated"


class UserSessionRestored(BaseEvent):
    event_type = "identity.user_session.restored"


class UserSessionDeleted(BaseEvent):
    event_type = "identity.user_session.deleted"


class UserSessionRevoked(BaseEvent):
    event_type = "identity.user_session.revoked"


class UserSessionExpired(BaseEvent):
    event_type = "identity.user_session.expired"
