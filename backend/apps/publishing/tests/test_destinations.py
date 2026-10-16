"""
API tests for publish destination endpoints (platform-global, org-free).
"""
import pytest
from django.urls import reverse
from rest_framework import status


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

    def test_destinations_are_platform_global(self, staff_client):
        """Destinations carry no org partition: every row is visible."""
        url = reverse("api:v1:publishing:destination-list")
        staff_client.post(
            url,
            {
                "name": "Global Storage",
                "type": "Storage Cluster",
                "path": "/mnt/global",
                "protocol": "NFS",
            },
            format="json",
        )

        response = staff_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        names = {row["name"] for row in response.data["results"]}
        assert "Global Storage" in names
