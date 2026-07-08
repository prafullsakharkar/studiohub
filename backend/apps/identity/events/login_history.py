from apps.core.events import DomainEvent


class LoginSucceeded(DomainEvent):
    event_type = "identity.login.success"


class LoginFailed(DomainEvent):
    event_type = "identity.login.failed"


class UserLoggedOut(DomainEvent):
    event_type = "identity.logout.completed"


class LoginHistoryCreated(DomainEvent):
    event_type = "identity.login_history.created"


class LoginHistoryDeleted(DomainEvent):
    event_type = "identity.login_history.deleted"
