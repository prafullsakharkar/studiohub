"""
API tests for publish destination endpoints.
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
    """Test publish destination API endpoints."""

    def test_list_destinations_empty(self, staff_client):
        url = reverse("api:v1:publishing:destination-list")
        response = staff_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        assert isinstance(response.data["results"], list)

    def test_create_destination(self, staff_client):
        url = reverse("api:v1:publishing:destination-list")

        data = {
            "name": "Test Storage",
            "type": "Storage Cluster",
            "path": "/mnt/test/publishes",
            "protocol": "NFS",
            "is_default": True,
            "region": "Test Lab",
        }

        response = staff_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Test Storage"
        assert response.data["type"] == "Storage Cluster"
        assert response.data["protocol"] == "NFS"

    def test_list_destinations_forbidden_for_regular_user(
        self, authenticated_client
    ):
        url = reverse("api:v1:publishing:destination-list")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_destination_forbidden_for_regular_user(
        self, authenticated_client
    ):
        url = reverse("api:v1:publishing:destination-list")
        response = authenticated_client.post(
            url,
            {
                "name": "Sneaky Storage",
                "type": "Storage Cluster",
                "path": "/tmp/x",
                "protocol": "NFS",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_destinations_isolated_by_organization(
        self, staff_client, _org_membership
    ):
        from apps.organization.tests.factories import OrganizationFactory

        other_org = OrganizationFactory.create()

        url = reverse("api:v1:publishing:destination-list")
        staff_client.post(
            url,
            {
                "name": "Org Scoped Storage",
                "type": "Storage Cluster",
                "path": "/mnt/scoped",
                "protocol": "NFS",
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(_org_membership.id),
        )

        response = staff_client.get(
            url, HTTP_X_ORGANIZATION_ID=str(other_org.id)
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []
