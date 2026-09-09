"""
Tests for the real per-organization billing endpoint.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.models import OrganizationBilling
from apps.organization.tests.factories import (
    OrganizationBillingFactory,
    OrganizationFactory,
    OrganizationMembershipFactory,
)

BILLING_URL = reverse("api:v1:organization-legacy:legacy-billing")


class TestBillingView:
    @pytest.mark.django_db
    def test_get_unauthenticated_401(self, api_client):
        response = api_client.get(BILLING_URL)

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_get_returns_org_billing_row(self, staff_client):
        org = OrganizationFactory.create()
        OrganizationBillingFactory.create(
            organization=org,
            farm_credits_total=500000,
            farm_credits_used=120000,
        )

        response = staff_client.get(BILLING_URL)

        assert response.status_code == 200
        data = response.json()
        assert data["tier"] == "Enterprise Vanguard"
        assert data["farm_credits_total"] == 500000
        assert data["farm_credits_used"] == 120000
        assert data["farm_credits_remaining"] == 380000
        assert isinstance(data["monthly_base_fee_usd"], int)

    @pytest.mark.django_db
    def test_get_scoped_to_header_org(self, db):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        OrganizationBillingFactory.create(organization=org_a, tier="Indie")
        OrganizationBillingFactory.create(organization=org_b, tier="Studio Pro")
        user = UserFactory.create()
        OrganizationMembershipFactory.create(organization=org_b, user=user)
        api = APIClient()
        api.force_authenticate(user=user)
        api.credentials(HTTP_X_ORGANIZATION_ID=str(org_b.id))

        response = api.get(BILLING_URL)

        assert response.status_code == 200
        assert response.json()["tier"] == "Studio Pro"

    @pytest.mark.django_db
    def test_patch_as_staff(self, staff_client):
        OrganizationFactory.create()

        response = staff_client.patch(
            BILLING_URL, {"max_seats_count": 500}, format="json"
        )

        assert response.status_code == 200
        assert response.json()["max_seats_count"] == 500

    @pytest.mark.django_db
    def test_patch_rejects_overuse(self, staff_client):
        org = OrganizationFactory.create()
        OrganizationBillingFactory.create(
            organization=org, farm_credits_total=1000, farm_credits_used=100
        )

        response = staff_client.patch(
            BILLING_URL, {"farm_credits_used": 5000}, format="json"
        )

        assert response.status_code == 400

    @pytest.mark.django_db
    def test_patch_non_staff_forbidden(self, user):
        api = APIClient()
        api.force_authenticate(user=user)
        OrganizationFactory.create()

        response = api.patch(BILLING_URL, {"max_seats_count": 10}, format="json")

        assert response.status_code == 403

    @pytest.mark.django_db
    def test_billing_row_auto_created(self, staff_client):
        org = OrganizationFactory.create()
        assert not OrganizationBilling.objects.filter(organization=org).exists()

        response = staff_client.get(BILLING_URL)

        assert response.status_code == 200
        assert OrganizationBilling.objects.filter(organization=org).exists()
