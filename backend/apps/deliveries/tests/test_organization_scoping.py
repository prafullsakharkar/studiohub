"""
Organization isolation tests for the deliveries API.

Verifies fail-closed organization scoping:
  * create auto-assigns the active organization (from the X-Organization header);
  * listing is scoped to the active organization (cross-tenant isolation);
  * switching the active organization changes the returned set;
  * detail access to another organization's delivery returns 404;
  * no organization context resolves to empty results / rejected writes.
"""
import uuid

import pytest
from django.urls import reverse
from rest_framework import status

from apps.deliveries.models import DeliveryPackage
from apps.organization.tests.factories import OrganizationFactory


@pytest.mark.django_db
class TestDeliveryOrganizationScoping:
    def _list_url(self):
        return reverse("api:v1:deliveries:delivery-list")

    def _detail_url(self, delivery):
        return reverse(
            "api:v1:deliveries:delivery-detail",
            kwargs={"uuid": str(delivery.id)},
        )

    def test_create_auto_assigns_organization_from_header(self, staff_client):
        org = OrganizationFactory.create()
        resp = staff_client.post(
            self._list_url(),
            data={
                "name": "Org Scoped Delivery",
                "code": "DEL-ORG-01",
                "delivery_method": "S3",
                "delivery_destination": "s3://bucket/path",
            },
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        delivery = DeliveryPackage.objects.get(code="DEL-ORG-01")
        assert delivery.organization_id == org.id

    def test_create_assigns_created_by(self, staff_client):
        from apps.identity.models import User

        org = OrganizationFactory.create()
        resp = staff_client.post(
            self._list_url(),
            data={"name": "Audit Delivery", "code": "DEL-ORG-02"},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        delivery = DeliveryPackage.objects.get(code="DEL-ORG-02")
        assert isinstance(delivery.created_by, User)

    def test_list_is_scoped_to_organization_header(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        DeliveryPackage.objects.create(
            name="A", code="DEL-ORG-AA", organization=org_a
        )
        DeliveryPackage.objects.create(
            name="B", code="DEL-ORG-BB", organization=org_b
        )
        resp = staff_client.get(
            self._list_url(), HTTP_X_ORGANIZATION_ID=str(org_a.id)
        )
        assert resp.status_code == status.HTTP_200_OK
        codes = {p["code"] for p in resp.data["results"]}
        assert "DEL-ORG-AA" in codes
        assert "DEL-ORG-BB" not in codes

    def test_switching_organization_header_changes_results(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        DeliveryPackage.objects.create(
            name="A", code="DEL-ORG-AA2", organization=org_a
        )
        DeliveryPackage.objects.create(
            name="B", code="DEL-ORG-BB2", organization=org_b
        )
        resp_b = staff_client.get(
            self._list_url(), HTTP_X_ORGANIZATION_ID=str(org_b.id)
        )
        assert resp_b.status_code == status.HTTP_200_OK
        codes_b = {p["code"] for p in resp_b.data["results"]}
        assert "DEL-ORG-BB2" in codes_b
        assert "DEL-ORG-AA2" not in codes_b

    def test_detail_is_scoped_to_organization(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        delivery = DeliveryPackage.objects.create(
            name="A", code="DEL-ORG-AA3", organization=org_a
        )
        resp = staff_client.get(
            self._detail_url(delivery),
            HTTP_X_ORGANIZATION_ID=str(org_b.id),
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_list_without_org_context_fails_closed(self, staff_client):
        """No org header must not leak every organization's deliveries."""
        DeliveryPackage.objects.create(
            name="A",
            code="DEL-ORG-AA4",
            organization=OrganizationFactory.create(),
        )
        resp = staff_client.get(self._list_url())
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["results"] == []

    def test_list_with_unknown_org_id_does_not_leak(self, staff_client):
        """An unresolvable org id must not fall back to all deliveries."""
        DeliveryPackage.objects.create(
            name="A",
            code="DEL-ORG-AA5",
            organization=OrganizationFactory.create(),
        )
        resp = staff_client.get(
            self._list_url(),
            HTTP_X_ORGANIZATION_ID=str(uuid.uuid4()),
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["results"] == []

    def test_create_without_org_context_fails_closed(self, staff_client):
        """Create must not assign to an arbitrary/first organization."""
        resp = staff_client.post(
            self._list_url(),
            data={"name": "No Org Delivery", "code": "DEL-ORG-99"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert not DeliveryPackage.objects.filter(code="DEL-ORG-99").exists()
