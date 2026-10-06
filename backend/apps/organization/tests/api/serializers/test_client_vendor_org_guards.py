"""
Cross-organization guards for client/vendor serializers.

Mirrors the person guard contract (see
``apps.organization.api.serializers.person.create`` and
``apps.organization.api.serializers.team.update``): submitted relation ids
must resolve inside the request organization; when no organization context
resolves, the legacy fail-open behavior is preserved.
"""

from __future__ import annotations

import pytest

from apps.organization.api.serializers.client import (
    ClientCreateSerializer,
    ClientUpdateSerializer,
)
from apps.organization.api.serializers.client_contact import (
    ClientContactCreateSerializer,
    ClientContactUpdateSerializer,
)
from apps.organization.api.serializers.client_contract import (
    ClientContractCreateSerializer,
    ClientContractUpdateSerializer,
)
from apps.organization.api.serializers.vendor import (
    VendorCreateSerializer,
    VendorUpdateSerializer,
)
from apps.organization.api.serializers.vendor_contact import (
    VendorContactCreateSerializer,
    VendorContactUpdateSerializer,
)
from apps.organization.api.serializers.vendor_contract import (
    VendorContractCreateSerializer,
    VendorContractUpdateSerializer,
)

from ...factories import (
    ClientContactFactory,
    ClientContractFactory,
    ClientFactory,
    OrganizationFactory,
    VendorContactFactory,
    VendorContractFactory,
    VendorFactory,
)


@pytest.fixture
def org_a(db):
    """First organization."""
    return OrganizationFactory.create()


@pytest.fixture
def org_b(db):
    """Second organization."""
    return OrganizationFactory.create()


@pytest.fixture
def request_in_org_a(rf, org_a):
    """Request carrying the first organization's context."""
    request = rf.post("/")
    request.organization = org_a
    return request


@pytest.fixture
def client_in_a(db, org_a):
    return ClientFactory.create(organization=org_a)


@pytest.fixture
def client_in_b(db, org_b):
    return ClientFactory.create(organization=org_b)


@pytest.fixture
def vendor_in_a(db, org_a):
    return VendorFactory.create(organization=org_a)


@pytest.fixture
def vendor_in_b(db, org_b):
    return VendorFactory.create(organization=org_b)


class TestClientContactOrganizationGuard:
    """ClientContact serializers reject cross-organization ids."""

    @pytest.mark.django_db
    def test_create_rejects_other_org_client(
        self, org_a, request_in_org_a, client_in_b
    ):
        data = {
            "organization_id": str(org_a.id),
            "client_id": str(client_in_b.id),
            "name": "Guarded Contact",
        }

        serializer = ClientContactCreateSerializer(
            data=data, context={"request": request_in_org_a}
        )

        assert not serializer.is_valid()
        assert "client_id" in serializer.errors

    @pytest.mark.django_db
    def test_create_accepts_same_org_client(
        self, org_a, request_in_org_a, client_in_a
    ):
        data = {
            "organization_id": str(org_a.id),
            "client_id": str(client_in_a.id),
            "name": "Guarded Contact",
        }

        serializer = ClientContactCreateSerializer(
            data=data, context={"request": request_in_org_a}
        )

        assert serializer.is_valid(), serializer.errors

    @pytest.mark.django_db
    def test_create_rejects_other_organization_id(
        self, org_b, request_in_org_a, client_in_a
    ):
        data = {
            "organization_id": str(org_b.id),
            "client_id": str(client_in_a.id),
            "name": "Guarded Contact",
        }

        serializer = ClientContactCreateSerializer(
            data=data, context={"request": request_in_org_a}
        )

        assert not serializer.is_valid()
        assert "organization" in str(serializer.errors).lower()

    @pytest.mark.django_db
    def test_update_rejects_other_org_client(
        self, request_in_org_a, client_in_a, client_in_b
    ):
        contact = ClientContactFactory.create(client=client_in_a)

        serializer = ClientContactUpdateSerializer(
            instance=contact,
            data={"client_id": str(client_in_b.id)},
            partial=True,
            context={"request": request_in_org_a},
        )

        assert not serializer.is_valid()
        assert "client_id" in serializer.errors

    @pytest.mark.django_db
    def test_create_without_organization_context_is_legacy_allowed(
        self, client_in_b
    ):
        """No request organization → legacy fail-open (person-guard contract)."""
        data = {
            "client_id": str(client_in_b.id),
            "name": "Legacy Contact",
        }

        serializer = ClientContactCreateSerializer(data=data, context={})

        assert serializer.is_valid(), serializer.errors


class TestVendorContactOrganizationGuard:
    """VendorContact serializers reject cross-organization ids."""

    @pytest.mark.django_db
    def test_create_rejects_other_org_vendor(
        self, request_in_org_a, vendor_in_b
    ):
        data = {
            "vendor_id": str(vendor_in_b.id),
            "name": "Guarded Contact",
        }

        serializer = VendorContactCreateSerializer(
            data=data, context={"request": request_in_org_a}
        )

        assert not serializer.is_valid()
        assert "vendor_id" in serializer.errors

    @pytest.mark.django_db
    def test_update_rejects_other_org_vendor(
        self, request_in_org_a, vendor_in_a, vendor_in_b
    ):
        contact = VendorContactFactory.create(vendor=vendor_in_a)

        serializer = VendorContactUpdateSerializer(
            instance=contact,
            data={"vendor_id": str(vendor_in_b.id)},
            partial=True,
            context={"request": request_in_org_a},
        )

        assert not serializer.is_valid()
        assert "vendor_id" in serializer.errors


class TestClientContractOrganizationGuard:
    """ClientContract serializers reject cross-organization ids."""

    @pytest.mark.django_db
    def test_create_rejects_other_org_client(
        self, request_in_org_a, client_in_b
    ):
        data = {
            "client_id": str(client_in_b.id),
            "contract_number": "CON-GUARD-1",
            "title": "Guarded Contract",
        }

        serializer = ClientContractCreateSerializer(
            data=data, context={"request": request_in_org_a}
        )

        assert not serializer.is_valid()
        assert "client_id" in serializer.errors

    @pytest.mark.django_db
    def test_create_accepts_same_org_client(
        self, request_in_org_a, client_in_a
    ):
        data = {
            "client_id": str(client_in_a.id),
            "contract_number": "CON-GUARD-2",
            "title": "Guarded Contract",
        }

        serializer = ClientContractCreateSerializer(
            data=data, context={"request": request_in_org_a}
        )

        assert serializer.is_valid(), serializer.errors

    @pytest.mark.django_db
    def test_update_rejects_other_org_client(
        self, request_in_org_a, client_in_a, client_in_b
    ):
        contract = ClientContractFactory.create(client=client_in_a)

        serializer = ClientContractUpdateSerializer(
            instance=contract,
            data={"client_id": str(client_in_b.id)},
            partial=True,
            context={"request": request_in_org_a},
        )

        assert not serializer.is_valid()
        assert "client_id" in serializer.errors


class TestVendorContractOrganizationGuard:
    """VendorContract serializers reject cross-organization ids."""

    @pytest.mark.django_db
    def test_create_rejects_other_org_vendor(
        self, request_in_org_a, vendor_in_b
    ):
        data = {
            "vendor_id": str(vendor_in_b.id),
            "contract_number": "VCON-GUARD-1",
            "title": "Guarded Contract",
        }

        serializer = VendorContractCreateSerializer(
            data=data, context={"request": request_in_org_a}
        )

        assert not serializer.is_valid()
        assert "vendor_id" in serializer.errors

    @pytest.mark.django_db
    def test_update_rejects_other_org_vendor(
        self, request_in_org_a, vendor_in_a, vendor_in_b
    ):
        contract = VendorContractFactory.create(vendor=vendor_in_a)

        serializer = VendorContractUpdateSerializer(
            instance=contract,
            data={"vendor_id": str(vendor_in_b.id)},
            partial=True,
            context={"request": request_in_org_a},
        )

        assert not serializer.is_valid()
        assert "vendor_id" in serializer.errors


class TestClientOrganizationGuard:
    """Client serializers reject other-organization payloads."""

    @pytest.mark.django_db
    def test_create_rejects_other_organization_id(
        self, org_b, request_in_org_a
    ):
        data = {
            "organization_id": str(org_b.id),
            "name": "Guarded Client",
            "code": "GCLI001",
        }

        serializer = ClientCreateSerializer(
            data=data, context={"request": request_in_org_a}
        )

        assert not serializer.is_valid()
        assert "organization" in str(serializer.errors).lower()

    @pytest.mark.django_db
    def test_create_accepts_request_organization_id(
        self, org_a, request_in_org_a
    ):
        data = {
            "organization_id": str(org_a.id),
            "name": "Guarded Client",
            "code": "GCLI002",
        }

        serializer = ClientCreateSerializer(
            data=data, context={"request": request_in_org_a}
        )

        assert serializer.is_valid(), serializer.errors

    @pytest.mark.django_db
    def test_update_rejects_other_organization_id(
        self, org_a, org_b, request_in_org_a, client_in_a
    ):
        serializer = ClientUpdateSerializer(
            instance=client_in_a,
            data={"organization_id": str(org_b.id)},
            partial=True,
            context={"request": request_in_org_a},
        )

        assert not serializer.is_valid()
        assert "organization" in str(serializer.errors).lower()


class TestVendorOrganizationGuard:
    """Vendor serializers reject other-organization payloads."""

    @pytest.mark.django_db
    def test_create_rejects_other_organization_id(
        self, org_b, request_in_org_a
    ):
        data = {
            "organization_id": str(org_b.id),
            "name": "Guarded Vendor",
            "code": "GVEN001",
        }

        serializer = VendorCreateSerializer(
            data=data, context={"request": request_in_org_a}
        )

        assert not serializer.is_valid()
        assert "organization" in str(serializer.errors).lower()

    @pytest.mark.django_db
    def test_update_rejects_other_organization_id(
        self, org_a, org_b, request_in_org_a, vendor_in_a
    ):
        serializer = VendorUpdateSerializer(
            instance=vendor_in_a,
            data={"organization_id": str(org_b.id)},
            partial=True,
            context={"request": request_in_org_a},
        )

        assert not serializer.is_valid()
        assert "organization" in str(serializer.errors).lower()
