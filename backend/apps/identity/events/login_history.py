from apps.core.events import BaseEvent


class LoginSucceeded(BaseEvent):
    event_type = "identity.login.success"


class LoginFailed(BaseEvent):
    event_type = "identity.login.failed"


class UserLoggedOut(BaseEvent):
    event_type = "identity.logout.completed"
