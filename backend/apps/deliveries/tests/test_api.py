"""
API tests for deliveries endpoints.
"""
import pytest
from django.urls import reverse
from rest_framework import status

from apps.deliveries.models import DeliveryPackage


@pytest.fixture(autouse=True)
def _org_membership(user, staff_user):
    """Give `user` and `staff_user` an organization membership.

    Several assertions construct objects with
    ``organization=user.organization_memberships.first().organization``,
    which crashes when the user has no membership. Tests authenticate via
    `staff_client`, so `staff_user` needs a membership for headerless
    organization resolution too.
    """
    from apps.organization.tests.factories import (
        OrganizationFactory,
        OrganizationMembershipFactory,
    )

    org = OrganizationFactory.create()
    OrganizationMembershipFactory.create(organization=org, user=user)
    OrganizationMembershipFactory.create(organization=org, user=staff_user)
    return org


@pytest.mark.django_db
class TestDeliveryEndpoints:
    """Test delivery API endpoints."""

    def test_list_deliveries_empty(self, staff_client):
        """Test listing deliveries when none exist."""
        url = reverse("api:v1:deliveries:delivery-list")
        response = staff_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        assert isinstance(response.data["results"], list)

    def test_create_delivery(self, staff_client):
        """Test creating a new delivery."""
        url = reverse("api:v1:deliveries:delivery-list")

        data = {
            "name": "Test Delivery",
            "code": "DEL-TEST-001",
            "delivery_method": "S3",
            "delivery_destination": "s3://bucket/path",
        }

        response = staff_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Test Delivery"
        assert response.data["code"] == "DEL-TEST-001"

    def test_get_delivery_detail(self, staff_client, _org_membership):
        """Test getting delivery details."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-002",
            organization=_org_membership,
        )

        url = reverse("api:v1:deliveries:delivery-detail", kwargs={"uuid": str(delivery.id)})
        response = staff_client.get(url, HTTP_X_ORGANIZATION_ID=str(_org_membership.id))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Test Delivery"

    def test_add_version_to_delivery(self, staff_client, _org_membership):
        """Test adding a version to a delivery."""
        org = _org_membership
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

        response = staff_client.post(
            url,
            data,
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert delivery.versions.count() == 1

    def test_validate_delivery(self, staff_client, _org_membership):
        """Test validating a delivery."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-004",
            organization=_org_membership,
        )

        url = reverse("api:v1:deliveries:delivery-validate", kwargs={"uuid": str(delivery.id)})
        response = staff_client.post(url, HTTP_X_ORGANIZATION_ID=str(_org_membership.id))

        assert response.status_code == status.HTTP_200_OK
        assert "success" in response.data

    def test_prepare_delivery(self, staff_client, _org_membership):
        """Test preparing a delivery."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-005",
            organization=_org_membership,
        )

        url = reverse("api:v1:deliveries:delivery-prepare", kwargs={"uuid": str(delivery.id)})
        response = staff_client.post(url, HTTP_X_ORGANIZATION_ID=str(_org_membership.id))

        assert response.status_code == status.HTTP_200_OK
        assert "success" in response.data

    def test_submit_delivery(self, staff_client, _org_membership):
        """Test submitting a delivery."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-006",
            organization=_org_membership,
        )

        url = reverse("api:v1:deliveries:delivery-submit", kwargs={"uuid": str(delivery.id)})
        response = staff_client.post(url, HTTP_X_ORGANIZATION_ID=str(_org_membership.id))

        assert response.status_code == status.HTTP_200_OK
        assert "success" in response.data

    def test_approve_delivery(self, staff_client, _org_membership):
        """Test approving a delivery."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-007",
            organization=_org_membership,
        )

        url = reverse("api:v1:deliveries:delivery-approve", kwargs={"uuid": str(delivery.id)})
        data = {"client_notes": "Looks good!"}
        response = staff_client.post(
            url,
            data,
            format="json",
            HTTP_X_ORGANIZATION_ID=str(_org_membership.id),
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Approved"

    def test_reject_delivery(self, staff_client, _org_membership):
        """Test rejecting a delivery."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-008",
            organization=_org_membership,
        )

        url = reverse("api:v1:deliveries:delivery-reject", kwargs={"uuid": str(delivery.id)})
        data = {"rejection_reason": "Missing files"}
        response = staff_client.post(
            url,
            data,
            format="json",
            HTTP_X_ORGANIZATION_ID=str(_org_membership.id),
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Rejected"

    def test_complete_delivery(self, staff_client, _org_membership):
        """Test completing a delivery."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-009",
            organization=_org_membership,
        )

        url = reverse("api:v1:deliveries:delivery-complete", kwargs={"uuid": str(delivery.id)})
        response = staff_client.post(url, HTTP_X_ORGANIZATION_ID=str(_org_membership.id))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Complete"

    def test_cancel_delivery(self, staff_client, _org_membership):
        """Test cancelling a delivery."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-010",
            organization=_org_membership,
        )

        url = reverse("api:v1:deliveries:delivery-cancel", kwargs={"uuid": str(delivery.id)})
        data = {"cancellation_reason": "No longer needed"}
        response = staff_client.post(
            url,
            data,
            format="json",
            HTTP_X_ORGANIZATION_ID=str(_org_membership.id),
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Cancelled"
