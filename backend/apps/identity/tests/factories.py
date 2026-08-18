"""
Identity test factories.
"""

from __future__ import annotations

import factory
from datetime import timedelta
from django.utils import timezone
from factory import LazyAttribute, Sequence
from factory.django import DjangoModelFactory
from factory.fuzzy import FuzzyChoice, FuzzyDate, FuzzyDecimal, FuzzyText

from apps.identity.choices import (
    OAuthProviderName,
    SecurityEventType,
)
from apps.identity.models.backup_code import BackupCode
from apps.identity.models.ip_blacklist import IPBlacklist
from apps.identity.models.known_device import KnownDevice
from apps.identity.models.login_attempt import LoginAttempt
from apps.identity.models.oauth_account import OAuthAccount
from apps.identity.models.oauth_provider import OAuthProvider
from apps.identity.models.profile import Profile
from apps.identity.models.security_event import SecurityEvent
from apps.identity.models.trusted_device import TrustedDevice
from apps.identity.models.user import User
from apps.identity.models.user_mfa import UserMFA


class UserFactory(DjangoModelFactory):
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


class ProfileFactory(DjangoModelFactory):
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


class OAuthProviderFactory(DjangoModelFactory):
    """Factory for OAuthProvider model."""

    class Meta:
        model = OAuthProvider
        django_get_or_create = ("name",)

    name = factory.Faker("word")
    client_id = factory.Faker("uuid4")
    client_secret = factory.Faker("uuid4")
    authorization_url = factory.Faker("url")
    token_url = factory.Faker("url")
    userinfo_url = factory.Faker("url")
    scope = "openid profile email"
    is_active = True


class OAuthAccountFactory(DjangoModelFactory):
    """Factory for OAuthAccount model."""

    class Meta:
        model = OAuthAccount
        django_get_or_create = ("user", "provider", "provider_account_id")

    user = factory.SubFactory(UserFactory)
    provider = factory.SubFactory(OAuthProviderFactory)
    provider_account_id = factory.Faker("uuid4")
    access_token = factory.Faker("uuid4")
    refresh_token = factory.Faker("uuid4")
    expires_at = factory.Faker("date_time_this_year")
    scope = "openid profile email"
    is_connected = True
    last_connected_at = factory.Faker("date_time_this_month")


class BackupCodeFactory(DjangoModelFactory):
    """Factory for BackupCode model."""

    class Meta:
        model = BackupCode
        django_get_or_create = ("user", "code_hash")

    user = factory.SubFactory(UserFactory)
    code_hash = factory.Faker("uuid4")
    used = False
    used_at = None
    expires_at = factory.Faker("date_time_this_year")


class TrustedDeviceFactory(DjangoModelFactory):
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


class KnownDeviceFactory(DjangoModelFactory):
    """Factory for KnownDevice model."""

    class Meta:
        model = KnownDevice
        django_get_or_create = ("user", "fingerprint")

    user = factory.SubFactory(UserFactory)
    fingerprint = factory.Faker("uuid4")
    browser = factory.Faker("word")
    platform = factory.Faker("word")
    device_type = "web"
    ip_address = "127.0.0.1"
    user_agent = "Mozilla/5.0"
    first_seen_at = factory.Faker("date_time_this_year")
    last_seen_at = factory.Faker("date_time_this_month")
    is_trusted = False


class LoginAttemptFactory(DjangoModelFactory):
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


class SecurityEventFactory(DjangoModelFactory):
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


class UserMFACFactory(DjangoModelFactory):
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



class IPBlacklistFactory(DjangoModelFactory):
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
