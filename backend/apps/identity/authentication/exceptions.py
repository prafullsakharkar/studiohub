from rest_framework.exceptions import AuthenticationFailed


class AuthenticationException(AuthenticationFailed):
    default_detail = "Authentication failed."


class InvalidCredentials(AuthenticationException):
    default_detail = "Invalid username or password."


class UserInactive(AuthenticationException):
    default_detail = "User account is inactive."


class UserLocked(AuthenticationException):
    default_detail = "User account is locked."


class EmailNotVerified(AuthenticationException):
    default_detail = "Email address is not verified."


class InvalidToken(AuthenticationException):
    default_detail = "Invalid token."


class ExpiredToken(AuthenticationException):
    default_detail = "Token has expired."


class RefreshTokenExpired(AuthenticationException):
    default_detail = "Refresh token has expired."


class SessionExpired(AuthenticationException):
    default_detail = "Session has expired."


class SessionRevoked(AuthenticationException):
    default_detail = "Session has been revoked."


class TooManyLoginAttempts(AuthenticationException):
    default_detail = "Too many login attempts."


class AuthenticationRequired(AuthenticationException):
    default_detail = "Authentication required."


class AccountLocked(AuthenticationException):
    default_detail = "Account Locked."


class MFARequired(AuthenticationException):
    default_detail = "Multi-factor Authentication Required."
