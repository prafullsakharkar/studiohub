from .base import IdentityException


class SessionExpired(
    IdentityException,
):
    default_code = "session_expired"

    default_message = "Session has expired."
