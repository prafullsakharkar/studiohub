"""
API tests for delivery destination endpoints.
"""
import pytest
from django.urls import reverse
from rest_framework import status


@pytest.fixture(autouse=True)
def _org_membership(user, staff_user):
    """Give `user` and `staff_user` an organization membership."""
    from apps.organization.tests.factories import (
        OrganizationFactory,
        OrganizationMembershipFactory,
    )

    org = OrganizationFactory.create()
    OrganizationMembershipFactory.create(organization=org, user=user)
    OrganizationMembershipFactory.create(organization=org, user=staff_user)
    return org


@pytest.mark.django_db
class TestDestinationEndpoints:
    """Test delivery destination API endpoints."""

    def test_list_destinations_empty(self, staff_client):
        url = reverse("api:v1:deliveries:destination-list")
        response = staff_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        assert isinstance(response.data["results"], list)

    def test_create_destination(self, staff_client):
        url = reverse("api:v1:deliveries:destination-list")

        data = {
            "name": "Test Aspera Endpoint",
            "type": "Aspera Connect",
            "endpoint": "aspera.example.com:33001",
            "credentials_configured": True,
            "transfer_rate_mbps": 500,
            "storage_region": "Test Region",
            "port": 33001,
            "target_directory": "/incoming/test",
        }

        response = staff_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Test Aspera Endpoint"
        assert response.data["type"] == "Aspera Connect"
        assert response.data["endpoint"] == "aspera.example.com:33001"

    def test_list_destinations_forbidden_for_regular_user(
        self, authenticated_client
    ):
        url = reverse("api:v1:deliveries:destination-list")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_destination_forbidden_for_regular_user(
        self, authenticated_client
    ):
        url = reverse("api:v1:deliveries:destination-list")
        response = authenticated_client.post(
            url,
            {
                "name": "Sneaky Endpoint",
                "type": "Client SFTP",
                "endpoint": "sftp.example.com",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_destinations_isolated_by_organization(
        self, staff_client, _org_membership
    ):
        from apps.organization.tests.factories import OrganizationFactory

        other_org = OrganizationFactory.create()

        url = reverse("api:v1:deliveries:destination-list")
        staff_client.post(
            url,
            {
                "name": "Org Scoped Endpoint",
                "type": "Client SFTP",
                "endpoint": "sftp.example.com",
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(_org_membership.id),
        )

        response = staff_client.get(
            url, HTTP_X_ORGANIZATION_ID=str(other_org.id)
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []
