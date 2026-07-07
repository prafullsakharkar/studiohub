from django.db import models


class SessionStatus(models.TextChoices):
    """
    Session lifecycle.
    """

    ACTIVE = "ACTIVE", "Active"

    EXPIRED = "EXPIRED", "Expired"

    LOGGED_OUT = "LOGGED_OUT", "Logged Out"

    REVOKED = "REVOKED", "Revoked"

    LOCKED = "LOCKED", "Locked"


class DeviceType(models.TextChoices):
    """
    Client device.
    """

    DESKTOP = "DESKTOP", "Desktop"

    LAPTOP = "LAPTOP", "Laptop"

    MOBILE = "MOBILE", "Mobile"

    TABLET = "TABLET", "Tablet"

    TV = "TV", "TV"

    BOT = "BOT", "Bot"

    UNKNOWN = "UNKNOWN", "Unknown"


class Browser(models.TextChoices):
    """
    Browser.
    """

    CHROME = "CHROME", "Chrome"

    FIREFOX = "FIREFOX", "Firefox"

    EDGE = "EDGE", "Edge"

    SAFARI = "SAFARI", "Safari"

    OPERA = "OPERA", "Opera"

    BRAVE = "BRAVE", "Brave"

    UNKNOWN = "UNKNOWN", "Unknown"


class OperatingSystem(models.TextChoices):
    """
    Operating System.
    """

    WINDOWS = "WINDOWS", "Windows"

    MACOS = "MACOS", "macOS"

    LINUX = "LINUX", "Linux"

    IOS = "IOS", "iOS"

    ANDROID = "ANDROID", "Android"

    UNKNOWN = "UNKNOWN", "Unknown"


class LogoutReason(models.TextChoices):
    """
    Logout reason.
    """

    USER = "USER", "User"

    ADMIN = "ADMIN", "Administrator"

    TOKEN_EXPIRED = "TOKEN_EXPIRED", "Token Expired"

    PASSWORD_CHANGED = (
        "PASSWORD_CHANGED",
        "Password Changed",
    )

    ACCOUNT_DISABLED = (
        "ACCOUNT_DISABLED",
        "Account Disabled",
    )

    ACCOUNT_LOCKED = (
        "ACCOUNT_LOCKED",
        "Account Locked",
    )

    SESSION_EXPIRED = (
        "SESSION_EXPIRED",
        "Session Expired",
    )

    SECURITY_POLICY = (
        "SECURITY_POLICY",
        "Security Policy",
    )

    SESSION_LIMIT = (
        "SESSION_LIMIT",
        "Session Limit",
    )

    UNKNOWN = (
        "UNKNOWN",
        "Unknown",
    )


class AuthenticationMethod(models.TextChoices):
    """
    Authentication mechanism.
    """

    PASSWORD = "PASSWORD", "Password"

    OTP = "OTP", "OTP"

    MFA = "MFA", "Multi Factor"

    GOOGLE = "GOOGLE", "Google"

    MICROSOFT = "MICROSOFT", "Microsoft"

    LDAP = "LDAP", "LDAP"

    API_KEY = "API_KEY", "API Key"

    SSO = "SSO", "Single Sign-On"
