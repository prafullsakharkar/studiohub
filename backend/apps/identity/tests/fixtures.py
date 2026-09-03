"""
Identity test fixtures.
"""

from __future__ import annotations

import pytest
from django.contrib.contenttypes.models import ContentType

from apps.identity.models.user import User

from .factories import (
    BackupCodeFactory,
    IPBlacklistFactory,
    KnownDeviceFactory,
    LoginAttemptFactory,
    OAuthAccountFactory,
    OAuthProviderFactory,
    ProfileFactory,
    SecurityEventFactory,
    TrustedDeviceFactory,
    UserFactory,
    UserMFACFactory,
)


@pytest.fixture
def user(db):
    """Create a user."""
    return UserFactory.create()


@pytest.fixture
def active_user(db):
    """Create an active user."""
    return UserFactory.create(is_active=True)


@pytest.fixture
def inactive_user(db):
    """Create an inactive user."""
    return UserFactory.create(is_active=False)


@pytest.fixture
def staff_user(db):
    """Create a staff user."""
    return UserFactory.create(is_staff=True)


@pytest.fixture
def admin_user(db):
    """Create an admin user."""
    return UserFactory.create(is_staff=True, is_superuser=True)


@pytest.fixture
def profile(db, user):
    """Create a profile linked to the ``user`` fixture."""
    return ProfileFactory.create(user=user)


@pytest.fixture
def oauth_provider(db):
    """Create an OAuth provider."""
    return OAuthProviderFactory.create()


@pytest.fixture
def oauth_account(db):
    """Create an OAuth account."""
    return OAuthAccountFactory.create()


@pytest.fixture
def backup_code(db):
    """Create a backup code."""
    return BackupCodeFactory.create()


@pytest.fixture
def trusted_device(db):
    """Create a trusted device."""
    return TrustedDeviceFactory.create()


@pytest.fixture
def known_device(db):
    """Create a known device."""
    return KnownDeviceFactory.create()


@pytest.fixture
def login_attempt(db):
    """Create a login attempt."""
    return LoginAttemptFactory.create()


@pytest.fixture
def security_event(db):
    """Create a security event."""
    return SecurityEventFactory.create()


@pytest.fixture
def user_mfa(db):
    """Create a user MFA."""
    return UserMFACFactory.create()


@pytest.fixture
def ip_blacklist(db):
    """Create an IP blacklist entry."""
    return IPBlacklistFactory.create()


@pytest.fixture
def content_type(db):
    """Get a content type."""
    return ContentType.objects.get_for_model(User)


@pytest.fixture
def api_client():
    """Get an unauthenticated API client."""
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def authenticated_client(user):
    """Get an authenticated API client."""
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def staff_client(staff_user):
    """Get a staff API client."""
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=staff_user)
    return client


@pytest.fixture
def admin_client(admin_user):
    """Get an admin API client."""
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client
