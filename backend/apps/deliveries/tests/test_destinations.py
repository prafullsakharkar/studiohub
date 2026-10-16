"""
API tests for delivery destination endpoints (platform-global, org-free).
"""
import pytest
from django.urls import reverse
from rest_framework import status


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

    def test_destinations_are_platform_global(self, staff_client):
        """Destinations carry no org partition: every row is visible."""
        url = reverse("api:v1:deliveries:destination-list")
        staff_client.post(
            url,
            {
                "name": "Global Endpoint",
                "type": "Client SFTP",
                "endpoint": "sftp.example.com",
            },
            format="json",
        )

        response = staff_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        codes = {row["name"] for row in response.data["results"]}
        assert "Global Endpoint" in codes

    def test_create_destination_with_frontend_aliases(self, staff_client):
        """Frontend posts rate/region instead of transfer_rate_mbps/storage_region."""
        url = reverse("api:v1:deliveries:destination-list")

        data = {
            "name": "Alias Endpoint",
            "type": "Aspera Connect",
            "endpoint": "aspera.example.com:33001",
            "rate": 750,
            "region": "Alias Region",
        }

        response = staff_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert response.data["transfer_rate_mbps"] == 750
        assert response.data["storage_region"] == "Alias Region"
