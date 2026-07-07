"""
Authentication constants.
"""

from datetime import timedelta


class AuthenticationConstants:
    """
    Enterprise authentication configuration.
    """

    ACCESS_TOKEN_LIFETIME = timedelta(
        minutes=30,
    )

    REFRESH_TOKEN_LIFETIME = timedelta(
        days=7,
    )

    PASSWORD_RESET_TIMEOUT = 60 * 60

    EMAIL_VERIFICATION_TIMEOUT = 24 * 60 * 60

    OTP_TIMEOUT = 300

    MAX_LOGIN_ATTEMPTS = 5

    LOCKOUT_TIME = 15 * 60

    MAX_ACTIVE_SESSIONS = 5

    PASSWORD_HISTORY = 5
