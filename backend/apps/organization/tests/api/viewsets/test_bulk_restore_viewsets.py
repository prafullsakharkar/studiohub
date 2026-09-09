"""
Tests for bulk operations, restore, and lifecycle validation on the
client/vendor contact, contract, client, and vendor viewsets.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.api.viewsets.test_contract_viewsets import (
    _grant_org_permissions,
)
from apps.organization.tests.factories import (
    ClientContactFactory,
    ClientContractFactory,
    ClientFactory,
    OrganizationFactory,
    OrganizationMembershipFactory,
    VendorContactFactory,
    VendorFactory,
)


def _contact_bulk_url(parent, action):
    return reverse(
        f"api:v1:organization-legacy:legacy-client-contact-{action}",
        kwargs={"client_pk": str(parent.id)},
    )


def _contact_restore_url(parent, contact_uuid):
    return reverse(
        "api:v1:organization-legacy:legacy-client-contact-restore",
        kwargs={"client_pk": str(parent.id), "uuid": str(contact_uuid)},
    )


def _contract_bulk_url(parent, action):
    return reverse(
        f"api:v1:organization-legacy:legacy-client-contract-{action}",
        kwargs={"client_pk": str(parent.id)},
    )


def _contract_detail_url(parent, contract_uuid):
    return reverse(
        "api:v1:organization-legacy:legacy-client-contract-detail",
        kwargs={"client_pk": str(parent.id), "uuid": str(contract_uuid)},
    )


def _contract_restore_url(parent, contract_uuid):
    return reverse(
        "api:v1:organization-legacy:legacy-client-contract-restore",
        kwargs={"client_pk": str(parent.id), "uuid": str(contract_uuid)},
    )


def _vendor_contract_bulk_url(parent, action):
    return reverse(
        f"api:v1:organization-legacy:legacy-vendor-contract-{action}",
        kwargs={"vendor_pk": str(parent.id)},
    )


def _contact_payload(**overrides):
    data = {
        "name": "Bulk Contact",
        "role": "Producer",
        "email": "bulk@example.com",
        "phone": "+1 (818) 555-0100",
        "timezone": "America/Los_Angeles (PST)",
        "portal_access": True,
        "is_primary": False,
    }
    data.update(overrides)
    return data


def _contract_payload(**overrides):
    data = {
        "contract_number": "SOW-BULK-01",
        "title": "Bulk SOW",
        "type": "SOW",
        "effective_date": "2025-01-01",
        "expiry_date": "2026-01-01",
        "value_usd": 100000,
        "status": "Active",
        "nda_signed": True,
    }
    data.update(overrides)
    return data


class TestClientContactBulk:
    """Bulk operations on client contacts."""

    @pytest.mark.django_db
    def test_bulk_create_mixed_results(self, staff_client):
        parent = ClientFactory.create()

        response = staff_client.post(
            _contact_bulk_url(parent, "bulk-create"),
            {
                "items": [
                    _contact_payload(email="one@example.com"),
                    {"name": "", "email": "not-an-email"},
                    _contact_payload(email="three@example.com"),
                ]
            },
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["processed"] == 3
        assert data["successful"] == 2
        assert data["failed"] == 1
        assert data["results"][0]["status"] == "created"
        assert data["results"][1]["status"] == "invalid"
        assert data["results"][2]["status"] == "created"

    @pytest.mark.django_db
    def test_bulk_create_rejects_non_list(self, staff_client):
        parent = ClientFactory.create()

        response = staff_client.post(
            _contact_bulk_url(parent, "bulk-create"),
            {"items": {"name": "Nope"}},
            format="json",
        )

        assert response.status_code == 400

    @pytest.mark.django_db
    def test_bulk_update_and_archive(self, staff_client):
        parent = ClientFactory.create()
        first = ClientContactFactory.create(client=parent)
        second = ClientContactFactory.create(client=parent)

        response = staff_client.patch(
            _contact_bulk_url(parent, "bulk-update"),
            {"items": [{"id": str(first.id), "role": "Senior Producer"}]},
            format="json",
        )

        assert response.status_code == 200
        assert response.json()["results"][0]["status"] == "updated"
        first.refresh_from_db()
        assert first.role == "Senior Producer"

        response = staff_client.post(
            _contact_bulk_url(parent, "bulk-archive"),
            {"ids": [str(second.id)]},
            format="json",
        )

        assert response.status_code == 200
        assert response.json()["results"][0]["status"] == "archived"
        second.refresh_from_db()
        assert second.is_deleted is True

    @pytest.mark.django_db
    def test_bulk_update_not_found(self, staff_client):
        from uuid import uuid4

        parent = ClientFactory.create()

        response = staff_client.patch(
            _contact_bulk_url(parent, "bulk-update"),
            {"items": [{"id": str(uuid4()), "role": "Ghost"}]},
            format="json",
        )

        assert response.status_code == 200
        assert response.json()["results"][0]["status"] == "not_found"

    @pytest.mark.django_db
    def test_restore_single_contact(self, staff_client):
        parent = ClientFactory.create()
        contact = ClientContactFactory.create(client=parent)
        staff_client.delete(
            reverse(
                "api:v1:organization-legacy:legacy-client-contact-detail",
                kwargs={"client_pk": str(parent.id), "uuid": str(contact.uuid)},
            )
        )

        response = staff_client.post(_contact_restore_url(parent, contact.uuid))

        assert response.status_code == 200
        assert response.json()["id"] == str(contact.id)
        contact.refresh_from_db()
        assert contact.is_deleted is False

    @pytest.mark.django_db
    def test_restore_non_deleted_contact_404(self, staff_client):
        parent = ClientFactory.create()
        contact = ClientContactFactory.create(client=parent)

        response = staff_client.post(_contact_restore_url(parent, contact.uuid))

        assert response.status_code == 404

    @pytest.mark.django_db
    def test_bulk_restore(self, staff_client):
        parent = ClientFactory.create()
        contact = ClientContactFactory.create(client=parent)
        contact.delete()

        response = staff_client.post(
            _contact_bulk_url(parent, "bulk-restore"),
            {"ids": [str(contact.id)]},
            format="json",
        )

        assert response.status_code == 200
        assert response.json()["results"][0]["status"] == "restored"
        contact.refresh_from_db()
        assert contact.is_deleted is False

    @pytest.mark.django_db
    def test_bulk_unauthenticated_401(self, api_client):
        parent = ClientFactory.create()

        response = api_client.post(
            _contact_bulk_url(parent, "bulk-create"),
            {"items": [_contact_payload()]},
            format="json",
        )

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_bulk_without_permission_403(self, user):
        api = APIClient()
        api.force_authenticate(user=user)
        parent = ClientFactory.create()

        response = api.post(
            _contact_bulk_url(parent, "bulk-create"),
            {"items": [_contact_payload()]},
            format="json",
        )

        assert response.status_code == 403

    @pytest.mark.django_db
    def test_bulk_cross_org_parent_404(self, db):
        org_b = OrganizationFactory.create()
        user = UserFactory.create()
        OrganizationMembershipFactory.create(organization=org_b, user=user)
        _grant_org_permissions(user, org_b)
        api = APIClient()
        api.force_authenticate(user=user)
        api.credentials(HTTP_X_ORGANIZATION_ID=str(org_b.id))

        org_a_parent = ClientFactory.create()

        response = api.post(
            _contact_bulk_url(org_a_parent, "bulk-create"),
            {"items": [_contact_payload()]},
            format="json",
        )

        assert response.status_code == 404


class TestClientContractValidation:
    """Lifecycle validation: dates (400) and duplicate numbers (409)."""

    @pytest.mark.django_db
    def test_create_inverted_dates_400(self, staff_client):
        parent = ClientFactory.create()

        response = staff_client.post(
            reverse(
                "api:v1:organization-legacy:legacy-client-contract-list",
                kwargs={"client_pk": str(parent.id)},
            ),
            _contract_payload(
                effective_date="2026-01-01",
                expiry_date="2025-01-01",
            ),
            format="json",
        )

        assert response.status_code == 400

    @pytest.mark.django_db
    def test_create_duplicate_number_409(self, staff_client):
        parent = ClientFactory.create()
        ClientContractFactory.create(client=parent, contract_number="SOW-DUP-01")

        response = staff_client.post(
            reverse(
                "api:v1:organization-legacy:legacy-client-contract-list",
                kwargs={"client_pk": str(parent.id)},
            ),
            _contract_payload(contract_number="SOW-DUP-01"),
            format="json",
        )

        assert response.status_code == 409

    @pytest.mark.django_db
    def test_update_duplicate_number_409(self, staff_client):
        parent = ClientFactory.create()
        ClientContractFactory.create(client=parent, contract_number="SOW-KEEP-01")
        other = ClientContractFactory.create(client=parent, contract_number="SOW-OLD-02")

        response = staff_client.patch(
            _contract_detail_url(parent, other.uuid),
            {"contract_number": "SOW-KEEP-01"},
            format="json",
        )

        assert response.status_code == 409

    @pytest.mark.django_db
    def test_same_number_different_client_ok(self, staff_client):
        first = ClientFactory.create()
        second = ClientFactory.create()
        ClientContractFactory.create(client=first, contract_number="SOW-SHARED-01")

        response = staff_client.post(
            reverse(
                "api:v1:organization-legacy:legacy-client-contract-list",
                kwargs={"client_pk": str(second.id)},
            ),
            _contract_payload(contract_number="SOW-SHARED-01"),
            format="json",
        )

        assert response.status_code == 201

    @pytest.mark.django_db
    def test_restore_single_contract(self, staff_client):
        parent = ClientFactory.create()
        contract = ClientContractFactory.create(client=parent)
        staff_client.delete(_contract_detail_url(parent, contract.uuid))

        response = staff_client.post(_contract_restore_url(parent, contract.uuid))

        assert response.status_code == 200
        assert response.json()["contract_number"] == contract.contract_number
        contract.refresh_from_db()
        assert contract.is_deleted is False

    @pytest.mark.django_db
    def test_bulk_create_contracts(self, staff_client):
        parent = ClientFactory.create()

        response = staff_client.post(
            _contract_bulk_url(parent, "bulk-create"),
            {
                "items": [
                    _contract_payload(contract_number="SOW-B-01"),
                    _contract_payload(
                        contract_number="SOW-B-02",
                        effective_date="2026-06-01",
                        expiry_date="2025-06-01",
                    ),
                ]
            },
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["processed"] == 2
        assert data["successful"] == 1
        assert data["results"][0]["status"] == "created"
        assert data["results"][1]["status"] == "invalid"

    @pytest.mark.django_db
    def test_bulk_create_duplicate_number(self, staff_client):
        parent = ClientFactory.create()
        ClientContractFactory.create(client=parent, contract_number="SOW-DUP-B-01")

        response = staff_client.post(
            _contract_bulk_url(parent, "bulk-create"),
            {"items": [_contract_payload(contract_number="SOW-DUP-B-01")]},
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["successful"] == 0
        assert data["results"][0]["status"] == "duplicate"


class TestVendorContractBulk:
    """Vendor-side bulk + restore mirror."""

    @pytest.mark.django_db
    def test_bulk_create_vendor_contracts(self, staff_client):
        vendor = VendorFactory.create()

        response = staff_client.post(
            _vendor_contract_bulk_url(vendor, "bulk-create"),
            {
                "items": [
                    {
                        "contract_number": "OUT-V-01",
                        "title": "Vendor SOW 1",
                        "type": "SOW",
                        "total_value_usd": 100000,
                        "status": "Active",
                    },
                    {
                        "contract_number": "OUT-V-02",
                        "title": "Vendor SOW 2",
                        "type": "SOW",
                        "total_value_usd": 200000,
                        "status": "Active",
                    },
                ]
            },
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["processed"] == 2
        assert data["successful"] == 2

    @pytest.mark.django_db
    def test_bulk_archive_and_restore_vendor_contact(self, staff_client):
        vendor = VendorFactory.create()
        contact = VendorContactFactory.create(vendor=vendor)
        bulk_url = reverse(
            "api:v1:organization-legacy:legacy-vendor-contact-bulk-archive",
            kwargs={"vendor_pk": str(vendor.id)},
        )

        response = staff_client.post(bulk_url, {"ids": [str(contact.id)]}, format="json")

        assert response.status_code == 200
        contact.refresh_from_db()
        assert contact.is_deleted is True

        restore_url = reverse(
            "api:v1:organization-legacy:legacy-vendor-contact-restore",
            kwargs={"vendor_pk": str(vendor.id), "uuid": str(contact.uuid)},
        )
        response = staff_client.post(restore_url)

        assert response.status_code == 200
        contact.refresh_from_db()
        assert contact.is_deleted is False


class TestClientVendorRestore:
    """Restore actions on the top-level client/vendor viewsets."""

    @pytest.mark.django_db
    def test_restore_client(self, staff_client):
        parent = ClientFactory.create()
        detail_url = reverse(
            "api:v1:organization-legacy:legacy-client-detail",
            kwargs={"uuid": str(parent.id)},
        )

        response = staff_client.delete(detail_url)
        assert response.status_code == 204
        # Soft-deleted clients disappear from detail.
        assert staff_client.get(detail_url).status_code == 404

        restore_url = reverse(
            "api:v1:organization-legacy:legacy-client-restore",
            kwargs={"uuid": str(parent.id)},
        )
        response = staff_client.post(restore_url)

        assert response.status_code == 200
        assert response.json()["id"] == str(parent.id)
        parent.refresh_from_db()
        assert parent.is_deleted is False

    @pytest.mark.django_db
    def test_restore_vendor(self, staff_client):
        vendor = VendorFactory.create()
        detail_url = reverse(
            "api:v1:organization-legacy:legacy-vendor-detail",
            kwargs={"uuid": str(vendor.id)},
        )

        response = staff_client.delete(detail_url)
        assert response.status_code == 204

        restore_url = reverse(
            "api:v1:organization-legacy:legacy-vendor-restore",
            kwargs={"uuid": str(vendor.id)},
        )
        response = staff_client.post(restore_url)

        assert response.status_code == 200
        vendor.refresh_from_db()
        assert vendor.is_deleted is False

    @pytest.mark.django_db
    def test_restore_non_deleted_client_404(self, staff_client):
        parent = ClientFactory.create()
        restore_url = reverse(
            "api:v1:organization-legacy:legacy-client-restore",
            kwargs={"uuid": str(parent.id)},
        )

        response = staff_client.post(restore_url)

        assert response.status_code == 404
