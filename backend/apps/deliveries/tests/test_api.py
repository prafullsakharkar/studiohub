"""
API tests for deliveries endpoints.
"""
import pytest
from django.urls import reverse
from rest_framework import status

from apps.deliveries.models import DeliveryPackage, DeliveryVersionRef


@pytest.fixture(autouse=True)
def _org_membership(user):
    """Give the built-in `user` fixture an organization membership.

    Several assertions construct objects with
    ``organization=user.organization_memberships.first().organization``,
    which crashes when the user has no membership.
    """
    from apps.organization.tests.factories import (
        OrganizationFactory,
        OrganizationMembershipFactory,
    )

    org = OrganizationFactory.create()
    OrganizationMembershipFactory.create(organization=org, user=user)
    return org


@pytest.mark.django_db
class TestDeliveryEndpoints:
    """Test delivery API endpoints."""
    
    def test_list_deliveries_empty(self, api_client, user):
        """Test listing deliveries when none exist."""
        api_client.force_authenticate(user=user)
        url = reverse("api:v1:deliveries:delivery-list")
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        assert isinstance(response.data["results"], list)
    
    def test_create_delivery(self, api_client, user):
        """Test creating a new delivery."""
        api_client.force_authenticate(user=user)
        url = reverse("api:v1:deliveries:delivery-list")
        
        data = {
            "name": "Test Delivery",
            "code": "DEL-TEST-001",
            "delivery_method": "S3",
            "delivery_destination": "s3://bucket/path",
        }
        
        response = api_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Test Delivery"
        assert response.data["code"] == "DEL-TEST-001"
    
    def test_get_delivery_detail(self, api_client, user):
        """Test getting delivery details."""
        api_client.force_authenticate(user=user)
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-002",
            organization=user.organization_memberships.first().organization,
        )
        
        url = reverse("api:v1:deliveries:delivery-detail", kwargs={"uuid": str(delivery.id)})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Test Delivery"
    
    def test_add_version_to_delivery(self, api_client, user):
        """Test adding a version to a delivery."""
        api_client.force_authenticate(user=user)
        org = user.organization_memberships.first().organization
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-003",
            organization=org,
        )
        from apps.production.models import Version
        version = Version.objects.create(
            organization=org,
            code="VER-001",
        )
        
        url = reverse("api:v1:deliveries:delivery-add-version", kwargs={"uuid": str(delivery.id)})
        data = {
            "version_id": str(version.id),
            "version_number": "v001",
            "entity_type": "Shot",
            "entity_code": "SH001",
            "entity_name": "Test Shot",
            "file_path": "/path/to/file.exr",
        }
        
        response = api_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert delivery.versions.count() == 1
    
    def test_validate_delivery(self, api_client, user):
        """Test validating a delivery."""
        api_client.force_authenticate(user=user)
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-004",
            organization=user.organization_memberships.first().organization,
        )
        
        url = reverse("api:v1:deliveries:delivery-validate", kwargs={"uuid": str(delivery.id)})
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert "success" in response.data
    
    def test_prepare_delivery(self, api_client, user):
        """Test preparing a delivery."""
        api_client.force_authenticate(user=user)
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-005",
            organization=user.organization_memberships.first().organization,
        )
        
        url = reverse("api:v1:deliveries:delivery-prepare", kwargs={"uuid": str(delivery.id)})
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert "success" in response.data
    
    def test_submit_delivery(self, api_client, user):
        """Test submitting a delivery."""
        api_client.force_authenticate(user=user)
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-006",
            organization=user.organization_memberships.first().organization,
        )
        
        url = reverse("api:v1:deliveries:delivery-submit", kwargs={"uuid": str(delivery.id)})
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert "success" in response.data
    
    def test_approve_delivery(self, api_client, user):
        """Test approving a delivery."""
        api_client.force_authenticate(user=user)
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-007",
            organization=user.organization_memberships.first().organization,
        )
        
        url = reverse("api:v1:deliveries:delivery-approve", kwargs={"uuid": str(delivery.id)})
        data = {"client_notes": "Looks good!"}
        response = api_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Approved"
    
    def test_reject_delivery(self, api_client, user):
        """Test rejecting a delivery."""
        api_client.force_authenticate(user=user)
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-008",
            organization=user.organization_memberships.first().organization,
        )
        
        url = reverse("api:v1:deliveries:delivery-reject", kwargs={"uuid": str(delivery.id)})
        data = {"rejection_reason": "Missing files"}
        response = api_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Rejected"
    
    def test_complete_delivery(self, api_client, user):
        """Test completing a delivery."""
        api_client.force_authenticate(user=user)
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-009",
            organization=user.organization_memberships.first().organization,
        )
        
        url = reverse("api:v1:deliveries:delivery-complete", kwargs={"uuid": str(delivery.id)})
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Complete"
    
    def test_cancel_delivery(self, api_client, user):
        """Test cancelling a delivery."""
        api_client.force_authenticate(user=user)
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-010",
            organization=user.organization_memberships.first().organization,
        )
        
        url = reverse("api:v1:deliveries:delivery-cancel", kwargs={"uuid": str(delivery.id)})
        data = {"cancellation_reason": "No longer needed"}
        response = api_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Cancelled"
