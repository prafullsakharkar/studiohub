from apps.core.events import DomainEvent


class SessionCreated(DomainEvent):
    event_type = "identity.session.created"


class SessionUpdated(DomainEvent):
    event_type = "identity.session.updated"


class SessionTouched(DomainEvent):
    event_type = "identity.session.touched"


class SessionRefreshed(DomainEvent):
    event_type = "identity.session.refreshed"


class SessionExpired(DomainEvent):
    event_type = "identity.session.expired"


class SessionRevoked(DomainEvent):
    event_type = "identity.session.revoked"


class SessionLoggedOut(DomainEvent):
    event_type = "identity.session.logged_out"


class SessionCurrentChanged(DomainEvent):
    event_type = "identity.session.current_changed"


class SessionTrusted(DomainEvent):
    event_type = "identity.session.trusted"
