"""
API tests for deliveries endpoints (platform-global, org-free).
"""
import pytest
from django.urls import reverse
from rest_framework import status

from apps.deliveries.models import DeliveryPackage


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

    def test_get_delivery_detail(self, staff_client):
        """Test getting delivery details."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-002",
        )

        url = reverse("api:v1:deliveries:delivery-detail", kwargs={"uuid": str(delivery.id)})
        response = staff_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Test Delivery"

    def test_add_version_to_delivery(self, staff_client):
        """A published version is added; its number and files come from the registry, not the body."""
        from apps.deliveries.tests.helpers import make_package, published_version

        delivery = make_package(code="DEL-TEST-003")
        version = published_version(delivery.project)

        url = reverse("api:v1:deliveries:delivery-add-version", kwargs={"uuid": str(delivery.id)})
        data = {
            "version_id": str(version.id),
            # what older clients still send; accepted and ignored
            "version_number": "v999",
            "entity_type": "Shot",
            "entity_code": "WRONG",
            "entity_name": "Typed by the client",
            "file_path": "/path/to/file.exr",
            "checksum_sha256": "nothex",
        }

        response = staff_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert delivery.versions.count() == 1
        ref = delivery.versions.get()
        assert ref.version_number == version.version_number != "v999"
        assert ref.file_path.startswith("PROJECTS:show/")
        assert ref.checksum_sha256 == "1" * 64

    def test_remove_version_from_delivery(self, staff_client):
        """Test removing a version reference from a delivery (by the older integer id)."""
        from apps.deliveries.tests.helpers import make_package, published_version

        delivery = make_package(code="DEL-TEST-004R")
        version = published_version(delivery.project)

        add_url = reverse(
            "api:v1:deliveries:delivery-add-version", kwargs={"uuid": str(delivery.id)}
        )
        staff_client.post(add_url, {"version_id": str(version.id)}, format="json")
        assert delivery.versions.count() == 1
        ref_id = str(delivery.versions.first().id)  # type: ignore[union-attr]

        url = reverse(
            "api:v1:deliveries:delivery-remove-version", kwargs={"uuid": str(delivery.id)}
        )
        response = staff_client.post(
            url,
            {"version_ref_id": ref_id},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert delivery.versions.count() == 0

    def test_destroy_delivery_soft_deletes(self, staff_client):
        """DELETE soft-deletes (regression: destroy 500'd without service_class)."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-DELETE",
        )

        url = reverse("api:v1:deliveries:delivery-detail", kwargs={"uuid": str(delivery.id)})
        response = staff_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        delivery.refresh_from_db()
        assert delivery.is_deleted is True

    def test_validate_delivery(self, staff_client):
        """Test validating a delivery."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-004",
        )

        url = reverse("api:v1:deliveries:delivery-validate", kwargs={"uuid": str(delivery.id)})
        response = staff_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert "success" in response.data

    def test_prepare_delivery(self, staff_client):
        """Test preparing a delivery that holds a published version."""
        from apps.deliveries.tests.helpers import package_with_items

        delivery = package_with_items(code="DEL-TEST-005")

        url = reverse("api:v1:deliveries:delivery-prepare", kwargs={"uuid": str(delivery.id)})
        response = staff_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert "success" in response.data

    def test_submit_delivery(self, staff_client):
        """Test submitting a prepared delivery."""
        from apps.deliveries.tests.helpers import prepared_package

        delivery = prepared_package(code="DEL-TEST-006")

        url = reverse("api:v1:deliveries:delivery-submit", kwargs={"uuid": str(delivery.id)})
        response = staff_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert "success" in response.data

    def test_approve_delivery(self, staff_client):
        """Test approving a delivery."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-007",
        )

        url = reverse("api:v1:deliveries:delivery-approve", kwargs={"uuid": str(delivery.id)})
        data = {"client_notes": "Looks good!"}
        response = staff_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Approved"

    def test_reject_delivery(self, staff_client):
        """Test rejecting a delivery."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-008",
        )

        url = reverse("api:v1:deliveries:delivery-reject", kwargs={"uuid": str(delivery.id)})
        data = {"rejection_reason": "Missing files"}
        response = staff_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Rejected"

    def test_complete_delivery(self, staff_client):
        """Test completing a delivery."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-009",
        )

        url = reverse("api:v1:deliveries:delivery-complete", kwargs={"uuid": str(delivery.id)})
        response = staff_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Completed"

    def test_cancel_delivery(self, staff_client):
        """Test cancelling a delivery."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-010",
        )

        url = reverse("api:v1:deliveries:delivery-cancel", kwargs={"uuid": str(delivery.id)})
        data = {"cancellation_reason": "No longer needed"}
        response = staff_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Cancelled"

    def test_retry_delivery(self, staff_client):
        """Test retrying a delivery resets it to Prepared (reads as Ready)."""
        delivery = DeliveryPackage.objects.create(
            name="Test Delivery",
            code="DEL-TEST-011",
            status=DeliveryPackage.STATUS_SUBMITTED,
        )

        url = reverse("api:v1:deliveries:delivery-retry", kwargs={"uuid": str(delivery.id)})
        response = staff_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Ready"
        delivery.refresh_from_db()
        assert delivery.status == DeliveryPackage.STATUS_PREPARED

    def test_prepare_reads_as_ready(self, staff_client):
        """Test the prepare action output uses the frontend status word."""
        from apps.deliveries.tests.helpers import package_with_items

        delivery = package_with_items(code="DEL-TEST-012")

        url = reverse("api:v1:deliveries:delivery-prepare", kwargs={"uuid": str(delivery.id)})
        response = staff_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Ready"
