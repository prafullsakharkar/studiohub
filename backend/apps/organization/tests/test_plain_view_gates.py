"""
Membership gates on plain-APIView surfaces: analytics aggregates and the
billing account must not be readable cross-organization via a bare header.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
)


def _hdr(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestAnalyticsMembershipGate:
    def test_member_can_read_kpis(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=org)
        response = _client_for(user).get("/api/v1/analytics/kpis/", **_hdr(org))
        assert response.status_code == 200, response.data

    def test_non_member_cannot_read_other_org_kpis(self):
        org = OrganizationFactory.create()
        other = OrganizationFactory.create()
        user = UserFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=other)
        response = _client_for(user).get("/api/v1/analytics/kpis/", **_hdr(org))
        assert response.status_code == 404, response.data

    def test_member_can_read_departments(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=org)
        response = _client_for(user).get(
            "/api/v1/analytics/departments/", **_hdr(org)
        )
        assert response.status_code == 200, response.data

    def test_non_member_cannot_read_other_org_departments(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        response = _client_for(user).get(
            "/api/v1/analytics/departments/", **_hdr(org)
        )
        assert response.status_code == 404, response.data


@pytest.mark.django_db
class TestBillingMembershipGate:
    def test_member_can_read_billing(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=org)
        response = _client_for(user).get("/api/v1/billing/", **_hdr(org))
        assert response.status_code == 200, response.data

    def test_non_member_cannot_read_other_org_billing(self):
        org = OrganizationFactory.create()
        other = OrganizationFactory.create()
        user = UserFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=other)
        response = _client_for(user).get("/api/v1/billing/", **_hdr(org))
        assert response.status_code == 404, response.data

    def test_member_cannot_update_billing(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=org)
        response = _client_for(user).patch(
            "/api/v1/billing/",
            {"storage_quota_tb": 99},
            format="json",
            **_hdr(org),
        )
        assert response.status_code == 403, response.data
