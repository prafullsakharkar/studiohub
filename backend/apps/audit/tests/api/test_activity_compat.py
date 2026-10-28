"""
Activity compat feed tests (Phase 3 gap P1-3).

Covers the frontend-contract alias served by ActivityCompatViewSet:
flat ``GET /api/v1/activity/`` — paginated ``{count, next, previous,
results}`` in the frontend shape.

The feed is platform-global: it carries no tenant partition. The legacy
nested ``/api/organizations/<org>/activity/`` route belongs to the
organization app (deleted in B7); until then it 404s because organization
IDs no longer address anything.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.audit.tests.factories import ActivityFactory
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions


def _flat_url():
    return reverse("api:v1:audit:activity-flat-list")


def _nested_url(org_lookup):
    # Raw path: the organization-nested namespace was deleted with the org
    # app (B7), so the route can only be addressed by path — and 404s by
    # absence.
    return f"/api/organizations/{org_lookup}/activity/"


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestActivityCompatFeed:
    def test_flat_returns_paginated_frontend_shape(self, admin_client):
        ActivityFactory.create(description="did a thing")

        response = admin_client.get(_flat_url())

        assert response.status_code == 200, response.data
        assert set(("count", "results")) <= set(response.data.keys())
        assert response.data["count"] == 1
        row = response.data["results"][0]
        assert row["description"] == "did a thing"
        assert "timestamp" in row and "actor_name" in row and "action" in row

    def test_flat_is_platform_global(self):
        ActivityFactory.create(description="row-a")
        ActivityFactory.create(description="row-b")
        user = UserFactory.create(is_superuser=True)
        grant_permissions(user, "audit.view")
        client = _client(user)

        response = client.get(_flat_url())

        assert response.status_code == 200, response.data
        assert response.data["count"] == 2

    def test_nested_org_route_404s(self):
        ActivityFactory.create(description="row-a")
        user = UserFactory.create()
        client = _client(user)

        response = client.get(_nested_url("nope"))

        assert response.status_code == 404

    def test_nested_unknown_org_404(self, staff_client):
        response = staff_client.get(_nested_url("nope"))

        assert response.status_code == 404

    def test_nested_org_id_404(self):
        """A real org id still 404s: org ids no longer address the feed."""
        ActivityFactory.create(description="row-a")
        user = UserFactory.create()
        client = _client(user)

        response = client.get(_nested_url("00000000-0000-0000-0000-000000000000"))

        assert response.status_code == 404
