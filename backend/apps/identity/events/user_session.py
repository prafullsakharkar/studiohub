from apps.core.events import BaseEvent


class SessionCreated(BaseEvent):
    event_type = "identity.session.created"


class SessionUpdated(BaseEvent):
    event_type = "identity.session.updated"


class SessionTouched(BaseEvent):
    event_type = "identity.session.touched"


class SessionRefreshed(BaseEvent):
    event_type = "identity.session.refreshed"


class SessionExpired(BaseEvent):
    event_type = "identity.session.expired"


class SessionRevoked(BaseEvent):
    event_type = "identity.session.revoked"


class SessionLoggedOut(BaseEvent):
    event_type = "identity.session.logged_out"


class SessionCurrentChanged(BaseEvent):
    event_type = "identity.session.current_changed"


class SessionTrusted(BaseEvent):
    event_type = "identity.session.trusted"
