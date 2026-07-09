from .base import IdentityException


class MFAException(IdentityException):
    default_code = "mfa_error"


class InvalidOTP(MFAException):
    default_code = "invalid_otp"

    default_message = "Invalid one-time password."


class ExpiredOTP(MFAException):
    default_code = "expired_otp"

    default_message = "One-time password expired."


class MFANotEnabled(MFAException):
    default_code = "mfa_not_enabled"

    default_message = "Multi-factor authentication is not enabled."
