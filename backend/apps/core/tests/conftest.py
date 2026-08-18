"""
Core test configuration.
"""

from __future__ import annotations

import pytest
from django.test import RequestFactory

from apps.core.tests.fixtures import *  # noqa: F401, F403


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
