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


class LoginAttemptCreated(
    DomainEvent,
):
    """Event triggered when a login attempt record is created."""

    event_type = "identity.login_attempt.created"


class LoginAttemptDeleted(
    DomainEvent,
):
    """Event triggered when a login attempt record is deleted."""

    event_type = "identity.login_attempt.deleted"
