"""
Identity test factories.
"""

from __future__ import annotations

from datetime import timedelta

import factory
from django.utils import timezone
from factory.django import DjangoModelFactory

from apps.identity.choices import (
    SecurityEventType,
    SessionStatus,
)
from apps.identity.models.backup_code import BackupCode
from apps.identity.models.ip_blacklist import IPBlacklist
from apps.identity.models.login_attempt import LoginAttempt
from apps.identity.models.profile import Profile
from apps.identity.models.security_event import SecurityEvent
from apps.identity.models.trusted_device import TrustedDevice
from apps.identity.models.user import User
from apps.identity.models.user_mfa import UserMFA
from apps.identity.models.user_session import UserSession


class UserFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    """Factory for User model."""

    class Meta:
        model = User
        django_get_or_create = ("email",)

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    is_active = True
    is_staff = False
    is_email_verified = False
    last_seen = None

    @classmethod
    def create_active(cls, **kwargs):
        """Create an active user."""
        return cls.create(is_active=True, **kwargs)

    @classmethod
    def create_inactive(cls, **kwargs):
        """Create an inactive user."""
        return cls.create(is_active=False, **kwargs)

    @classmethod
    def create_staff(cls, **kwargs):
        """Create a staff user."""
        return cls.create(is_staff=True, **kwargs)

    @classmethod
    def create_superuser(cls, **kwargs):
        """Create a superuser."""
        return cls.create(is_staff=True, is_superuser=True, **kwargs)


class ProfileFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    """Factory for Profile model."""

    class Meta:
        model = Profile
        django_get_or_create = ("user",)

    user = factory.SubFactory(UserFactory)
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    display_name = factory.LazyAttribute(lambda o: f"{o.first_name} {o.last_name}".strip())
    avatar = factory.django.ImageField(filename="avatar.png")
    phone = factory.Faker("phone_number")
    bio = factory.Faker("text", max_nb_chars=500)
    timezone = "UTC"
    language = "en"
    preferences = {}


class BackupCodeFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    """Factory for BackupCode model."""

    class Meta:
        model = BackupCode
        django_get_or_create = ("user", "code_hash")

    user = factory.SubFactory(UserFactory)
    code_hash = factory.Faker("uuid4")
    used = False
    used_at = None
    expires_at = factory.Faker("date_time_this_year")


class TrustedDeviceFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    """Factory for TrustedDevice model."""

    class Meta:
        model = TrustedDevice
        django_get_or_create = ("user", "fingerprint")

    user = factory.SubFactory(UserFactory)
    fingerprint = factory.Faker("uuid4")
    browser = factory.Faker("word")
    platform = factory.Faker("word")
    ip_address = "127.0.0.1"
    user_agent = "Mozilla/5.0"
    last_login_at = factory.Faker("date_time_this_month")
    expires_at = factory.LazyFunction(lambda: timezone.now() + timedelta(days=30))
    is_trusted = True




class LoginAttemptFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    """Factory for LoginAttempt model."""

    class Meta:
        model = LoginAttempt
        django_get_or_create = ("username", "ip_address")

    user = factory.SubFactory(UserFactory)
    username = factory.Faker("email")
    ip_address = "127.0.0.1"
    user_agent = "Mozilla/5.0"
    success = False
    reason = "invalid_credentials"
    attempted_at = factory.Faker("date_time_this_month")


class SecurityEventFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    """Factory for SecurityEvent model."""

    class Meta:
        model = SecurityEvent

    user = factory.SubFactory(UserFactory)
    event_type = SecurityEventType.LOGIN_SUCCESS
    ip_address = "127.0.0.1"
    user_agent = "Mozilla/5.0"
    description = factory.Faker("text", max_nb_chars=255)
    metadata = {}
    is_critical = False


class UserMFACFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    """Factory for UserMFA model."""

    class Meta:
        model = UserMFA
        django_get_or_create = ("user",)

    user = factory.SubFactory(UserFactory)
    totp_secret = factory.Faker("uuid4")
    primary_method = "totp"
    status = "disabled"
    email_enabled = False
    sms_enabled = False
    recovery_enabled = True
    is_verified = False
    last_used_at = None
    failed_attempts = 0
    locked_until = None
    totp_confirmed_at = None
    last_verified_ip = "127.0.0.1"
    last_verified_user_agent = "Mozilla/5.0"



class IPBlacklistFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    """Factory for IPBlacklist model."""

    class Meta:
        model = IPBlacklist

    ip_address = factory.Sequence(lambda n: f"192.168.1.{n % 200 + 1}")
    network = ""
    description = factory.Faker("text", max_nb_chars=255)
    reason = factory.Faker("sentence")
    blocked_by = factory.SubFactory(UserFactory)
    is_active = True
    expires_at = None
    last_hit_at = None
    hit_count = 0
    metadata = {}


class UserSessionFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    """Factory for the identity-owned UserSession model."""

    class Meta:
        model = UserSession

    user = factory.SubFactory(UserFactory)
    session_key = factory.Faker("uuid4")
    ip_address = factory.Faker("ipv4")
    user_agent = factory.Faker("user_agent")
    status = SessionStatus.ACTIVE
    expires_at = factory.LazyFunction(lambda: timezone.now() + timedelta(days=30))
    logged_out_at = None
