"""
Tests for ClientContractViewSet and VendorContractViewSet.

Tests CRUD, nested parent scoping, organization isolation, permission
enforcement, and filtering against the actual viewset implementations.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.constants.permissions import OrganizationPermissions
from apps.organization.tests.factories import (
    ClientContractFactory,
    ClientFactory,
    OrganizationFactory,
    OrganizationMembershipFactory,
    PermissionFactory,
    RoleFactory,
    RolePermissionFactory,
    UserRoleFactory,
    VendorContractFactory,
    VendorFactory,
)

ORG_PERMISSION_CODES = (
    OrganizationPermissions.VIEW,
    OrganizationPermissions.CREATE,
    OrganizationPermissions.UPDATE,
    OrganizationPermissions.DELETE,
)


def _org_permission(code):
    """Create a Permission from a dotted code (factory defaults action to view)."""
    module, action = code.split(".", 1)
    return PermissionFactory.create(code=code, module=module, action=action)


def _grant_org_permissions(user, organization):
    """
    Grant the generic organization permissions to a user via role chain.
    """
    role = RoleFactory.create(organization=organization)

    for code in ORG_PERMISSION_CODES:
        RolePermissionFactory.create(
            role=role,
            permission=_org_permission(code),
        )

    UserRoleFactory.create(user=user, role=role)

    return role


def _client_list_url(parent):
    return reverse(
        "api:v1:organization-legacy:legacy-client-contract-list",
        kwargs={"client_pk": str(parent.id)},
    )


def _client_detail_url(parent, contract_uuid):
    return reverse(
        "api:v1:organization-legacy:legacy-client-contract-detail",
        kwargs={"client_pk": str(parent.id), "uuid": str(contract_uuid)},
    )


def _vendor_list_url(parent):
    return reverse(
        "api:v1:organization-legacy:legacy-vendor-contract-list",
        kwargs={"vendor_pk": str(parent.id)},
    )


def _vendor_detail_url(parent, contract_uuid):
    return reverse(
        "api:v1:organization-legacy:legacy-vendor-contract-detail",
        kwargs={"vendor_pk": str(parent.id), "uuid": str(contract_uuid)},
    )


def _contract_payload(**overrides):
    data = {
        "contract_number": "SOW-NK99-PHASE2",
        "title": "Main Feature Principal VFX Turnover SOW",
        "type": "SOW",
        "effective_date": "2025-11-15",
        "expiry_date": "2026-10-30",
        "value_usd": 4800000,
        "status": "Active",
        "nda_signed": True,
        "document_url": "https://vault.example.com/SOW-NK99-PHASE2.pdf",
    }
    data.update(overrides)
    return data


def _vendor_contract_payload(**overrides):
    data = _contract_payload()
    data["total_value_usd"] = data.pop("value_usd")
    data["security_tier"] = "MPAA Certified Tier 4"
    data.pop("document_url", None)
    data.update(overrides)
    return data


def _org_parent(organization=None):
    """Create a client (with its organization) for tests."""
    if organization is None:
        parent = ClientFactory.create()
    else:
        parent = ClientFactory.create(organization=organization)
    return parent


class TestClientContractViewSetAuth:
    """Authentication and permission tests."""

    @pytest.mark.django_db
    def test_list_unauthenticated(self, api_client):
        parent = _org_parent()

        response = api_client.get(_client_list_url(parent))

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_create_unauthenticated(self, api_client):
        parent = _org_parent()

        response = api_client.post(
            _client_list_url(parent), _contract_payload(), format="json"
        )

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_regular_user_without_permission_gets_403(self, user):
        api = APIClient()
        api.force_authenticate(user=user)

        parent = _org_parent()

        response = api.get(_client_list_url(parent))

        assert response.status_code == 403


class TestClientContractViewSetCRUD:
    """CRUD tests as staff (admin context)."""

    @pytest.mark.django_db
    def test_list_contracts(self, staff_client):
        parent = _org_parent()
        contracts = ClientContractFactory.create_batch(3, client=parent)
        # Contract under another client must not appear
        ClientContractFactory.create()

        response = staff_client.get(_client_list_url(parent))

        assert response.status_code == 200
        data = response.json()
        results = data["results"] if isinstance(data, dict) and "results" in data else data
        assert len(results) == 3
        returned_ids = {row["id"] for row in results}
        assert returned_ids == {str(c.id) for c in contracts}

    @pytest.mark.django_db
    def test_retrieve_contract(self, staff_client):
        parent = _org_parent()
        contract = ClientContractFactory.create(client=parent)

        response = staff_client.get(_client_detail_url(parent, contract.uuid))

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(contract.id)
        assert data["client_id"] == str(parent.id)
        assert data["contract_number"] == contract.contract_number
        assert data["value_usd"] == contract.value_usd

    @pytest.mark.django_db
    def test_create_contract(self, staff_client):
        parent = _org_parent()

        response = staff_client.post(
            _client_list_url(parent), _contract_payload(), format="json"
        )

        assert response.status_code == 201
        data = response.json()
        assert data["contract_number"] == "SOW-NK99-PHASE2"
        assert data["value_usd"] == 4800000
        assert data["nda_signed"] is True

        # Parent linkage is exposed by the read serializer.
        detail = staff_client.get(_client_detail_url(parent, data["id"]))
        assert detail.status_code == 200
        detail_data = detail.json()
        assert detail_data["client_id"] == str(parent.id)
        assert detail_data["organization_id"] == str(parent.organization_id)

    @pytest.mark.django_db
    def test_create_contract_parent_from_url_not_payload(self, staff_client):
        """A payload parent/organization must be ignored — URL parent wins."""
        parent = _org_parent()
        other_parent = _org_parent()

        payload = _contract_payload()
        payload["client_id"] = str(other_parent.id)
        payload["organization_id"] = str(other_parent.organization_id)

        response = staff_client.post(
            _client_list_url(parent), payload, format="json"
        )

        assert response.status_code == 201
        created_id = response.json()["id"]

        detail = staff_client.get(_client_detail_url(parent, created_id))
        assert detail.status_code == 200
        detail_data = detail.json()
        assert detail_data["client_id"] == str(parent.id)
        assert detail_data["organization_id"] == str(parent.organization_id)

    @pytest.mark.django_db
    def test_create_contract_unknown_parent_404(self, staff_client):
        url = reverse(
            "api:v1:organization-legacy:legacy-client-contract-list",
            kwargs={"client_pk": str(uuid4())},
        )

        response = staff_client.post(url, _contract_payload(), format="json")

        assert response.status_code == 404

    @pytest.mark.django_db
    def test_update_contract(self, staff_client):
        parent = _org_parent()
        contract = ClientContractFactory.create(client=parent)

        response = staff_client.patch(
            _client_detail_url(parent, contract.uuid),
            {"status": "Expired"},
            format="json",
        )

        assert response.status_code == 200
        assert response.json()["status"] == "Expired"

    @pytest.mark.django_db
    def test_delete_contract_soft_deletes(self, staff_client):
        parent = _org_parent()
        contract = ClientContractFactory.create(client=parent)

        response = staff_client.delete(_client_detail_url(parent, contract.uuid))

        assert response.status_code == 204
        contract.refresh_from_db()
        assert contract.is_deleted is True

    @pytest.mark.django_db
    def test_retrieve_contract_under_wrong_parent_404(self, staff_client):
        parent = _org_parent()
        other_parent = _org_parent()
        contract = ClientContractFactory.create(client=parent)

        response = staff_client.get(_client_detail_url(other_parent, contract.uuid))

        assert response.status_code == 404


class TestClientContractViewSetIsolation:
    """Organization isolation tests (non-staff, header-scoped)."""

    @pytest.fixture
    def scoped_user_client(self, db):
        """
        Regular user with organization permissions, scoped to their own
        organization via the X-Organization-Id header.
        """
        org_b = OrganizationFactory.create()
        user = UserFactory.create()
        OrganizationMembershipFactory.create(organization=org_b, user=user)
        _grant_org_permissions(user, org_b)

        api = APIClient()
        api.force_authenticate(user=user)
        api.credentials(HTTP_X_ORGANIZATION_ID=str(org_b.id))
        return api, org_b

    @pytest.mark.django_db
    def test_user_cannot_list_other_org_contracts(self, scoped_user_client):
        api, _org_b = scoped_user_client
        org_a_parent = _org_parent()
        ClientContractFactory.create_batch(2, client=org_a_parent)

        response = api.get(_client_list_url(org_a_parent))

        assert response.status_code == 200
        data = response.json()
        results = data["results"] if isinstance(data, dict) and "results" in data else data
        assert len(results) == 0

    @pytest.mark.django_db
    def test_user_cannot_retrieve_other_org_contract(self, scoped_user_client):
        api, _org_b = scoped_user_client
        org_a_parent = _org_parent()
        contract = ClientContractFactory.create(client=org_a_parent)

        response = api.get(_client_detail_url(org_a_parent, contract.uuid))

        assert response.status_code == 404

    @pytest.mark.django_db
    def test_user_cannot_create_contract_for_other_org_client(
        self, scoped_user_client
    ):
        api, _org_b = scoped_user_client
        org_a_parent = _org_parent()

        response = api.post(
            _client_list_url(org_a_parent), _contract_payload(), format="json"
        )

        assert response.status_code == 404

    @pytest.mark.django_db
    def test_user_can_manage_own_org_contracts(self, scoped_user_client):
        api, org_b = scoped_user_client
        own_parent = ClientFactory.create(organization=org_b)

        response = api.post(
            _client_list_url(own_parent), _contract_payload(), format="json"
        )

        assert response.status_code == 201
        created_id = response.json()["id"]

        # Parent linkage is exposed by the read serializer.
        detail = api.get(_client_detail_url(own_parent, created_id))
        assert detail.status_code == 200
        detail_data = detail.json()
        assert detail_data["client_id"] == str(own_parent.id)
        assert detail_data["organization_id"] == str(org_b.id)


class TestClientContractViewSetFiltering:
    """Filter and search tests."""

    @pytest.mark.django_db
    def test_filter_status(self, staff_client):
        parent = _org_parent()
        active = ClientContractFactory.create(client=parent, status="Active")
        ClientContractFactory.create(client=parent, status="Expired")

        response = staff_client.get(
            _client_list_url(parent), {"status": "Active"}
        )

        assert response.status_code == 200
        data = response.json()
        results = data["results"] if isinstance(data, dict) and "results" in data else data
        assert len(results) == 1
        assert results[0]["id"] == str(active.id)

    @pytest.mark.django_db
    def test_search_by_contract_number(self, staff_client):
        parent = _org_parent()
        match = ClientContractFactory.create(
            client=parent, contract_number="SOW-NK99-PHASE2"
        )
        ClientContractFactory.create(client=parent, contract_number="MSA-OTHER-01")

        response = staff_client.get(
            _client_list_url(parent), {"search": "NK99"}
        )

        assert response.status_code == 200
        data = response.json()
        results = data["results"] if isinstance(data, dict) and "results" in data else data
        assert len(results) == 1
        assert results[0]["id"] == str(match.id)


class TestVendorContractViewSet:
    """Vendor contract tests (mirror of client contract coverage)."""

    @pytest.mark.django_db
    def test_list_contracts(self, staff_client):
        vendor = VendorFactory.create()
        contracts = VendorContractFactory.create_batch(3, vendor=vendor)
        VendorContractFactory.create()

        response = staff_client.get(_vendor_list_url(vendor))

        assert response.status_code == 200
        data = response.json()
        results = data["results"] if isinstance(data, dict) and "results" in data else data
        assert len(results) == 3
        returned_ids = {row["id"] for row in results}
        assert returned_ids == {str(c.id) for c in contracts}

    @pytest.mark.django_db
    def test_create_contract(self, staff_client):
        vendor = VendorFactory.create()

        response = staff_client.post(
            _vendor_list_url(vendor), _vendor_contract_payload(), format="json"
        )

        assert response.status_code == 201
        data = response.json()
        assert data["contract_number"] == "SOW-NK99-PHASE2"
        assert data["total_value_usd"] == 4800000
        assert data["security_tier"] == "MPAA Certified Tier 4"
        # Vendor contracts have no document_url field
        assert "document_url" not in data

        # Parent linkage is exposed by the read serializer.
        detail = staff_client.get(_vendor_detail_url(vendor, data["id"]))
        assert detail.status_code == 200
        detail_data = detail.json()
        assert detail_data["vendor_id"] == str(vendor.id)
        assert detail_data["organization_id"] == str(vendor.organization_id)
        assert "document_url" not in detail_data

    @pytest.mark.django_db
    def test_update_contract(self, staff_client):
        vendor = VendorFactory.create()
        contract = VendorContractFactory.create(vendor=vendor)

        response = staff_client.patch(
            _vendor_detail_url(vendor, contract.uuid),
            {"status": "Pending Renewal"},
            format="json",
        )

        assert response.status_code == 200
        assert response.json()["status"] == "Pending Renewal"

    @pytest.mark.django_db
    def test_delete_contract(self, staff_client):
        vendor = VendorFactory.create()
        contract = VendorContractFactory.create(vendor=vendor)

        response = staff_client.delete(_vendor_detail_url(vendor, contract.uuid))

        assert response.status_code == 204
        contract.refresh_from_db()
        assert contract.is_deleted is True

    @pytest.mark.django_db
    def test_regular_user_without_permission_gets_403(self, user):
        api = APIClient()
        api.force_authenticate(user=user)

        vendor = VendorFactory.create()

        response = api.get(_vendor_list_url(vendor))

        assert response.status_code == 403
