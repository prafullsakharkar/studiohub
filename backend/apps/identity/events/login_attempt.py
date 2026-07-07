from apps.core.events import BaseEvent


class LoginAttemptSucceeded(
    BaseEvent,
):
    event_type = "identity.login_attempt.succeeded"


class LoginAttemptFailed(
    BaseEvent,
):
    event_type = "identity.login_attempt.failed"


class AccountLocked(
    BaseEvent,
):
    event_type = "identity.account.locked"
