"""
Identity test configuration.
"""

from __future__ import annotations

import pytest
from django.test import RequestFactory

from .fixtures import *  # noqa: F401, F403


@pytest.fixture
def rf():
    """RequestFactory instance."""
    return RequestFactory()


@pytest.fixture
def authenticated_request(rf, user):
    """Create an authenticated request."""
    request = rf.get("/")
    request.user = user
    return request


@pytest.fixture
def staff_request(rf, staff_user):
    """Create a staff request."""
    request = rf.get("/")
    request.user = staff_user
    return request


@pytest.fixture
def admin_request(rf, admin_user):
    """Create an admin request."""
    request = rf.get("/")
    request.user = admin_user
    return request
