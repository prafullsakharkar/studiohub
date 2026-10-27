"""
Publishing test configuration.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.core.tests.fixtures import *  # noqa: F401, F403
from apps.identity.tests.factories import UserFactory


@pytest.fixture
def staff_user(db):
    """Create a staff user."""
    return UserFactory(is_staff=True)


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


@pytest.fixture
def project(db):
    from apps.production.tests.factories import ProjectFactory

    return ProjectFactory.create(code="PUBP")


@pytest.fixture
def root(db):
    from apps.publishing.tests.helpers import storage_root

    return storage_root()
