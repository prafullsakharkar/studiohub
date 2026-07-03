from apps.core.events import BaseEvent


class SessionCreated(BaseEvent):
    event_type = "identity.session.created"


class SessionUpdated(BaseEvent):
    event_type = "identity.session.updated"


class SessionRevoked(BaseEvent):
    event_type = "identity.session.revoked"


class SessionExpired(BaseEvent):
    event_type = "identity.session.expired"


class SessionActivityUpdated(BaseEvent):
    event_type = "identity.session.activity.updated"
