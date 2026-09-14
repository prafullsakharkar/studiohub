"""
Activity compat feed tests (Phase 3 gap P1-3).

Covers the frontend-contract aliases served by ActivityCompatViewSet:
flat ``GET /api/v1/activity/`` and nested
``GET /api/organizations/<org>/activity/`` — both paginated
``{count, next, previous, results}`` in the frontend shape.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.audit.tests.factories import ActivityFactory
from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
)


def _flat_url():
    return reverse("api:v1:audit:activity-flat-list")


def _nested_url(org_lookup):
    return reverse(
        "api:organization-nested:nested-activity-list",
        kwargs={"organization_id": org_lookup},
    )


def _member_client(user, organization):
    OrganizationMembershipFactory.create(user=user, organization=organization)
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_ORGANIZATION_ID=str(organization.id))
    return client


@pytest.mark.django_db
class TestActivityCompatFeed:
    def test_flat_returns_paginated_frontend_shape(self, staff_client):
        org = OrganizationFactory.create()
        ActivityFactory.create(organization=org, description="did a thing")

        response = staff_client.get(_flat_url())

        assert response.status_code == 200, response.data
        assert set(("count", "results")) <= set(response.data.keys())
        assert response.data["count"] == 1
        row = response.data["results"][0]
        assert row["description"] == "did a thing"
        assert "timestamp" in row and "actor_name" in row and "action" in row

    def test_flat_scoped_to_member_orgs(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        ActivityFactory.create(organization=org_a)
        ActivityFactory.create(organization=org_b)
        user = UserFactory.create()
        client = _member_client(user, org_a)

        response = client.get(_flat_url())

        assert response.status_code == 200, response.data
        assert response.data["count"] == 1

    def test_nested_returns_org_feed(self):
        org = OrganizationFactory.create()
        ActivityFactory.create(organization=org)
        user = UserFactory.create()
        client = _member_client(user, org)

        response = client.get(_nested_url(str(org.id)))

        assert response.status_code == 200, response.data
        assert response.data["count"] == 1

    def test_nested_unknown_org_404(self, staff_client):
        response = staff_client.get(_nested_url("nope"))

        assert response.status_code == 404

    def test_nested_non_member_gets_empty(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        ActivityFactory.create(organization=org_b)
        user = UserFactory.create()
        client = _member_client(user, org_a)

        response = client.get(_nested_url(str(org_b.id)))

        assert response.status_code == 200, response.data
        assert response.data["count"] == 0
