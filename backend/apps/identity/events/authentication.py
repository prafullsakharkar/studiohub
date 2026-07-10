from dataclasses import dataclass
from typing import Any

from apps.core.events import DomainEvent


class UserAuthenticationEvent(
    DomainEvent,
):
    """
    Base authentication event.
    """

    category = "authentication"


@dataclass(frozen=True, slots=True, kw_only=True)
class VerificationEmailSent(DomainEvent):
    """
    Raised when a verification email should be delivered to a user.
    """

    event_type = "identity.user.verification_email_sent"

    category = "authentication"

    instance: Any


@dataclass(frozen=True, slots=True, kw_only=True)
class EmailVerified(DomainEvent):
    """
    Raised when a user's email address has been verified.
    """

    event_type = "identity.user.email_verified"

    category = "authentication"

    instance: Any


class UserLoggedIn(
    UserAuthenticationEvent,
):
    event_type = "identity.user.logged_in"


class UserLoginFailed(
    UserAuthenticationEvent,
):
    event_type = "identity.user.login_failed"


class UserLoggedOut(
    UserAuthenticationEvent,
):
    event_type = "identity.user.logged_out"


class UserTokenRefreshed(
    UserAuthenticationEvent,
):
    event_type = "identity.user.token_refreshed"


class UserSessionCreated(
    UserAuthenticationEvent,
):
    event_type = "identity.user.session_created"


class UserSessionExpired(
    UserAuthenticationEvent,
):
    event_type = "identity.user.session_expired"


class UserSessionRevoked(
    UserAuthenticationEvent,
):
    event_type = "identity.user.session_revoked"


class UserSessionTrusted(
    UserAuthenticationEvent,
):
    event_type = "identity.user.session_trusted"


class UserLoggedOutAllDevices(
    UserAuthenticationEvent,
):
    event_type = "identity.user.logged_out_all_devices"


class UserLoggedOutOtherDevices(
    UserAuthenticationEvent,
):
    event_type = "identity.user.logged_out_other_devices"
