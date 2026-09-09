"""
Tests for ClientContactViewSet and VendorContactViewSet.

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
    ClientContactFactory,
    ClientFactory,
    OrganizationFactory,
    OrganizationMembershipFactory,
    PermissionFactory,
    RoleFactory,
    RolePermissionFactory,
    UserRoleFactory,
    VendorContactFactory,
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


def _client_list_url(client):
    return reverse(
        "api:v1:organization-legacy:legacy-client-contact-list",
        kwargs={"client_pk": str(client.id)},
    )


def _client_detail_url(client, contact_uuid):
    return reverse(
        "api:v1:organization-legacy:legacy-client-contact-detail",
        kwargs={"client_pk": str(client.id), "uuid": str(contact_uuid)},
    )


def _vendor_list_url(vendor):
    return reverse(
        "api:v1:organization-legacy:legacy-vendor-contact-list",
        kwargs={"vendor_pk": str(vendor.id)},
    )


def _vendor_detail_url(vendor, contact_uuid):
    return reverse(
        "api:v1:organization-legacy:legacy-vendor-contact-detail",
        kwargs={"vendor_pk": str(vendor.id), "uuid": str(contact_uuid)},
    )


def _contact_payload(**overrides):
    data = {
        "name": "David Kogen",
        "role": "Executive Producer",
        "email": "david@example.com",
        "phone": "+1 (818) 555-0199",
        "timezone": "America/Los_Angeles (PST)",
        "portal_access": True,
        "is_primary": True,
    }
    data.update(overrides)
    return data


def _org_client(organization=None):
    """Create a client (with its organization) for tests."""
    if organization is None:
        client = ClientFactory.create()
    else:
        client = ClientFactory.create(organization=organization)
    return client


class TestClientContactViewSetAuth:
    """Authentication and permission tests."""

    @pytest.mark.django_db
    def test_list_unauthenticated(self, api_client):
        client = _org_client()

        response = api_client.get(_client_list_url(client))

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_create_unauthenticated(self, api_client):
        client = _org_client()

        response = api_client.post(
            _client_list_url(client), _contact_payload(), format="json"
        )

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_regular_user_without_permission_gets_403(self, user):
        api = APIClient()
        api.force_authenticate(user=user)

        parent = _org_client()

        response = api.get(_client_list_url(parent))

        assert response.status_code == 403


class TestClientContactViewSetCRUD:
    """CRUD tests as staff (admin context)."""

    @pytest.mark.django_db
    def test_list_contacts(self, staff_client):
        parent = _org_client()
        contacts = ClientContactFactory.create_batch(3, client=parent)
        # Contact under another client must not appear
        ClientContactFactory.create()

        response = staff_client.get(_client_list_url(parent))

        assert response.status_code == 200
        data = response.json()
        results = data["results"] if isinstance(data, dict) and "results" in data else data
        assert len(results) == 3
        returned_ids = {row["id"] for row in results}
        assert returned_ids == {str(c.id) for c in contacts}

    @pytest.mark.django_db
    def test_retrieve_contact(self, staff_client):
        parent = _org_client()
        contact = ClientContactFactory.create(client=parent)

        response = staff_client.get(_client_detail_url(parent, contact.uuid))

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(contact.id)
        assert data["client_id"] == str(parent.id)
        assert data["name"] == contact.name
        assert data["portal_access"] is True

    @pytest.mark.django_db
    def test_create_contact(self, staff_client):
        parent = _org_client()

        response = staff_client.post(
            _client_list_url(parent), _contact_payload(), format="json"
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "David Kogen"
        assert data["is_primary"] is True
        assert data["portal_access"] is True

        # Parent linkage is exposed by the read serializer.
        detail = staff_client.get(_client_detail_url(parent, data["id"]))
        assert detail.status_code == 200
        detail_data = detail.json()
        assert detail_data["client_id"] == str(parent.id)
        assert detail_data["organization_id"] == str(parent.organization_id)

    @pytest.mark.django_db
    def test_create_contact_parent_from_url_not_payload(self, staff_client):
        """A payload parent/organization must be ignored — URL parent wins."""
        parent = _org_client()
        other_client = _org_client()

        payload = _contact_payload()
        payload["client_id"] = str(other_client.id)
        payload["organization_id"] = str(other_client.organization_id)

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
    def test_create_contact_unknown_parent_404(self, staff_client):
        url = reverse(
            "api:v1:organization-legacy:legacy-client-contact-list",
            kwargs={"client_pk": str(uuid4())},
        )

        response = staff_client.post(url, _contact_payload(), format="json")

        assert response.status_code == 404

    @pytest.mark.django_db
    def test_update_contact(self, staff_client):
        parent = _org_client()
        contact = ClientContactFactory.create(client=parent)

        response = staff_client.patch(
            _client_detail_url(parent, contact.uuid),
            {"role": "Senior VFX Producer"},
            format="json",
        )

        assert response.status_code == 200
        assert response.json()["role"] == "Senior VFX Producer"

    @pytest.mark.django_db
    def test_delete_contact_soft_deletes(self, staff_client):
        parent = _org_client()
        contact = ClientContactFactory.create(client=parent)

        response = staff_client.delete(_client_detail_url(parent, contact.uuid))

        assert response.status_code == 204
        contact.refresh_from_db()
        assert contact.is_deleted is True

    @pytest.mark.django_db
    def test_retrieve_contact_under_wrong_parent_404(self, staff_client):
        parent = _org_client()
        other_parent = _org_client()
        contact = ClientContactFactory.create(client=parent)

        response = staff_client.get(_client_detail_url(other_parent, contact.uuid))

        assert response.status_code == 404


class TestClientContactViewSetIsolation:
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
    def test_user_cannot_list_other_org_contacts(self, scoped_user_client):
        api, _org_b = scoped_user_client
        org_a_client = _org_client()
        ClientContactFactory.create_batch(2, client=org_a_client)

        response = api.get(_client_list_url(org_a_client))

        assert response.status_code == 200
        data = response.json()
        results = data["results"] if isinstance(data, dict) and "results" in data else data
        assert len(results) == 0

    @pytest.mark.django_db
    def test_user_cannot_retrieve_other_org_contact(self, scoped_user_client):
        api, _org_b = scoped_user_client
        org_a_client = _org_client()
        contact = ClientContactFactory.create(client=org_a_client)

        response = api.get(_client_detail_url(org_a_client, contact.uuid))

        assert response.status_code == 404

    @pytest.mark.django_db
    def test_user_cannot_create_contact_for_other_org_client(
        self, scoped_user_client
    ):
        api, _org_b = scoped_user_client
        org_a_client = _org_client()

        response = api.post(
            _client_list_url(org_a_client), _contact_payload(), format="json"
        )

        assert response.status_code == 404

    @pytest.mark.django_db
    def test_user_can_manage_own_org_contacts(self, scoped_user_client):
        api, org_b = scoped_user_client
        own_client = ClientFactory.create(organization=org_b)

        response = api.post(
            _client_list_url(own_client), _contact_payload(), format="json"
        )

        assert response.status_code == 201
        created_id = response.json()["id"]

        # Parent linkage is exposed by the read serializer.
        detail = api.get(_client_detail_url(own_client, created_id))
        assert detail.status_code == 200
        detail_data = detail.json()
        assert detail_data["client_id"] == str(own_client.id)
        assert detail_data["organization_id"] == str(org_b.id)


class TestClientContactViewSetFiltering:
    """Filter and search tests."""

    @pytest.mark.django_db
    def test_filter_is_primary(self, staff_client):
        parent = _org_client()
        primary = ClientContactFactory.create(client=parent, is_primary=True)
        ClientContactFactory.create(client=parent, is_primary=False)

        response = staff_client.get(
            _client_list_url(parent), {"is_primary": "true"}
        )

        assert response.status_code == 200
        data = response.json()
        results = data["results"] if isinstance(data, dict) and "results" in data else data
        assert len(results) == 1
        assert results[0]["id"] == str(primary.id)

    @pytest.mark.django_db
    def test_search_by_name(self, staff_client):
        parent = _org_client()
        match = ClientContactFactory.create(
            client=parent, name="Rachel Steinberg"
        )
        ClientContactFactory.create(client=parent, name="Harrison Vance")

        response = staff_client.get(
            _client_list_url(parent), {"search": "Rachel"}
        )

        assert response.status_code == 200
        data = response.json()
        results = data["results"] if isinstance(data, dict) and "results" in data else data
        assert len(results) == 1
        assert results[0]["id"] == str(match.id)


class TestVendorContactViewSet:
    """Vendor contact tests (mirror of client contact coverage)."""

    @pytest.mark.django_db
    def test_list_contacts(self, staff_client):
        vendor = VendorFactory.create()
        contacts = VendorContactFactory.create_batch(3, vendor=vendor)
        VendorContactFactory.create()

        response = staff_client.get(_vendor_list_url(vendor))

        assert response.status_code == 200
        data = response.json()
        results = data["results"] if isinstance(data, dict) and "results" in data else data
        assert len(results) == 3
        returned_ids = {row["id"] for row in results}
        assert returned_ids == {str(c.id) for c in contacts}

    @pytest.mark.django_db
    def test_create_contact(self, staff_client):
        vendor = VendorFactory.create()

        payload = {
            "name": "Rohit Sharma",
            "role": "Managing Director",
            "email": "rohit@vendor.example.com",
            "phone": "+91 (22) 5550-9182",
            "timezone": "Asia/Kolkata (IST)",
            "is_primary": True,
        }

        response = staff_client.post(_vendor_list_url(vendor), payload, format="json")

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Rohit Sharma"
        assert data["is_primary"] is True
        # Vendor contacts have no portal_access field
        assert "portal_access" not in data

        # Parent linkage is exposed by the read serializer.
        detail = staff_client.get(_vendor_detail_url(vendor, data["id"]))
        assert detail.status_code == 200
        detail_data = detail.json()
        assert detail_data["vendor_id"] == str(vendor.id)
        assert detail_data["organization_id"] == str(vendor.organization_id)
        assert "portal_access" not in detail_data

    @pytest.mark.django_db
    def test_update_contact(self, staff_client):
        vendor = VendorFactory.create()
        contact = VendorContactFactory.create(vendor=vendor)

        response = staff_client.patch(
            _vendor_detail_url(vendor, contact.uuid),
            {"role": "Lead Coordinator"},
            format="json",
        )

        assert response.status_code == 200
        assert response.json()["role"] == "Lead Coordinator"

    @pytest.mark.django_db
    def test_delete_contact(self, staff_client):
        vendor = VendorFactory.create()
        contact = VendorContactFactory.create(vendor=vendor)

        response = staff_client.delete(_vendor_detail_url(vendor, contact.uuid))

        assert response.status_code == 204
        contact.refresh_from_db()
        assert contact.is_deleted is True

    @pytest.mark.django_db
    def test_regular_user_without_permission_gets_403(self, user):
        api = APIClient()
        api.force_authenticate(user=user)

        vendor = VendorFactory.create()

        response = api.get(_vendor_list_url(vendor))

        assert response.status_code == 403
