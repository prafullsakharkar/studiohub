from rest_framework.exceptions import AuthenticationFailed


class InvalidCredentials(AuthenticationFailed):
    default_detail = "Invalid email or password."

    default_code = "invalid_credentials"


class UserInactive(AuthenticationFailed):
    default_detail = "User account is inactive."

    default_code = "inactive_user"


class EmailNotVerified(AuthenticationFailed):
    default_detail = "Email address has not been verified."

    default_code = "email_not_verified"


class PasswordExpired(AuthenticationFailed):
    default_detail = "Password has expired."

    default_code = "password_expired"
