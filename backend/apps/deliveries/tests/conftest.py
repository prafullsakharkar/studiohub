"""
Deliveries test configuration.
"""
from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.core.tests.fixtures import *  # noqa: F401, F403
from apps.deliveries.tests.fixtures import *  # noqa: F401, F403
from apps.identity.tests.factories import UserFactory


@pytest.fixture
def staff_user(db):
    """A staff user who is a platform admin: deliveries are narrowed to the caller's projects, and
    the tests that use this fixture are not about scoping (those build their own members)."""
    return UserFactory(is_staff=True, is_superuser=True)


@pytest.fixture
def staff_client(staff_user) -> APIClient:
    """Staff API client (staff holds explicit full permission grants).

    Platform endpoints are platform-global and permission-checked through the
    identity resolver, so grants must come from the identity-native helper
    (org-helper grants live in org tables the resolver cannot see).
    """
    from apps.identity.tests.rbac_helpers import grant_all_known_codes

    grant_all_known_codes(staff_user)
    client = APIClient()
    client.force_authenticate(user=staff_user)
    return client
