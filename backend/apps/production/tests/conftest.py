"""
Production test configuration.
"""
from __future__ import annotations

import pytest

from apps.core.tests.fixtures import *  # noqa: F401, F403


@pytest.fixture
def staff_client(staff_user):
    """Staff API client with platform-global permission grants.

    Shadows ``apps.core.tests.fixtures.staff_client``: production views
    resolve permissions platform-globally (identity ``UserRole`` grants
    only), so the legacy org-membership grant path no longer authorizes.
    """
    from rest_framework.test import APIClient

    from apps.identity.tests.rbac_helpers import grant_all_known_codes

    grant_all_known_codes(staff_user)
    client = APIClient()
    client.force_authenticate(user=staff_user)
    return client
