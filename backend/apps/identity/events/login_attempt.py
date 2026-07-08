from apps.core.events import DomainEvent


class LoginAttemptSucceeded(
    DomainEvent,
):
    event_type = "identity.login_attempt.succeeded"


class LoginAttemptFailed(
    DomainEvent,
):
    event_type = "identity.login_attempt.failed"


class AccountLocked(
    DomainEvent,
):
    event_type = "identity.account.locked"
