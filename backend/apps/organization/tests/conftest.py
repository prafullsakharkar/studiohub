"""
Organization test configuration.
"""

from __future__ import annotations

import pytest
from django.test import RequestFactory

from apps.organization.models.organization import Organization

from .fixtures import *  # noqa: F401, F403


@pytest.fixture
def rf():
    """RequestFactory instance."""
    return RequestFactory()


@pytest.fixture
def organization_request(rf, organization):
    """Create a request with organization."""
    request = rf.get("/")
    request.organization = organization
    return request


@pytest.fixture
def authenticated_request(rf, user, organization):
    """Create an authenticated request."""
    request = rf.get("/")
    request.user = user
    request.organization = organization
    return request
