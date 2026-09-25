"""
Tests for ADR-0033 D5: GET /api/v1/auth/me/organizations/.

The organization listing is server-filtered: members only see their
active organizations; superusers see all; soft-deleted/suspended
memberships grant nothing.
"""

from __future__ import annotations

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
)

URL = "/api/v1/auth/me/organizations/"


@pytest.mark.django_db
class TestAuthMeOrganizations:
    def test_unauthenticated_returns_401(self):
        assert APIClient().get(URL).status_code == status.HTTP_401_UNAUTHORIZED

    def test_member_sees_only_member_organizations(self):
        user = UserFactory.create()
        member_org = OrganizationFactory.create(name="Zeta Studios")
        OrganizationFactory.create(name="Other Studios")
        OrganizationMembershipFactory.create(
            user=user, organization=member_org, status="active"
        )

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get(URL)

        assert response.status_code == status.HTTP_200_OK
        names = [row["name"] for row in response.data]
        assert names == ["Zeta Studios"]

    def test_soft_deleted_membership_grants_nothing(self):
        user = UserFactory.create()
        org = OrganizationFactory.create(name="Deleted Link Studios")
        membership = OrganizationMembershipFactory.create(
            user=user, organization=org, status="active"
        )
        membership.delete()  # soft-delete

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get(URL)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_superuser_sees_all_organizations(self):
        user = UserFactory.create(is_superuser=True)
        OrganizationFactory.create(name="Alpha Studios")
        OrganizationFactory.create(name="Beta Studios")

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get(URL)

        assert response.status_code == status.HTTP_200_OK
        names = set(row["name"] for row in response.data)
        assert {"Alpha Studios", "Beta Studios"} <= names
