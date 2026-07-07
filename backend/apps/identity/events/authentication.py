from apps.core.events import BaseEvent


class UserAuthenticationEvent(
    BaseEvent,
):
    """
    Base authentication event.
    """

    category = "authentication"


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
