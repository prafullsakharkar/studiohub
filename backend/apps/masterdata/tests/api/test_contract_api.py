"""HTTP contract of client and vendor contracts (CONTRACTS §4.3, API-MD-CTR-*)."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.constants.permissions import MasterdataPermissions as P
from apps.masterdata.models import ClientContract
from apps.masterdata.tests.factories import (
    ClientContractFactory,
    ClientFactory,
    VendorContractFactory,
    VendorFactory,
)

pytestmark = pytest.mark.django_db

API = "/api/v1"
TODAY = timezone.localdate()


def day(offset):
    return TODAY + timedelta(days=offset)


def client_for(*codes):
    user = UserFactory.create()
    if codes:
        grant_permissions(user, *codes)
    api = APIClient(raise_request_exception=False)
    api.force_authenticate(user=user)
    return api


@pytest.fixture
def reader():
    return client_for()


@pytest.fixture
def manager():
    return client_for(P.DIRECTORY_MANAGE)


@pytest.fixture
def privileged():
    return client_for(P.DIRECTORY_MANAGE, P.CLIENT_VIEW_FINANCIAL)


def code_of(response):
    return response.json()["error"]["code"]


def payload(owner, **kw):
    return {
        "client": str(owner.pk),
        "contract_number": "SOW-1",
        "title": "Title",
        "type": "SOW",
        "status": "Draft",
        **kw,
    }


class TestAccess:
    def test_anonymous_is_refused(self):
        assert APIClient().get(f"{API}/client-contracts/").status_code == 401

    def test_reading_is_open_but_writing_needs_manage(self, reader):
        row = ClientContractFactory()
        assert reader.get(f"{API}/client-contracts/{row.pk}/").status_code == 200
        owner = ClientFactory()
        assert reader.post(f"{API}/client-contracts/", payload(owner)).status_code == 403
        for action in ("activate", "terminate"):
            assert reader.post(f"{API}/client-contracts/{row.pk}/{action}/").status_code == 403
        assert (
            reader.post(
                f"{API}/client-contracts/{row.pk}/adjust-end-date/", {"expiry_date": "2020-01-01"}
            ).status_code
            == 403
        )


class TestFinancialGating:
    def test_the_value_is_omitted_without_view_financial(self, reader, privileged):
        row = ClientContractFactory(value_usd=5000)
        assert "value_usd" not in reader.get(f"{API}/client-contracts/{row.pk}/").json()
        assert privileged.get(f"{API}/client-contracts/{row.pk}/").json()["value_usd"] == 5000
        v = VendorContractFactory(total_value_usd=7000)
        assert "total_value_usd" not in reader.get(f"{API}/vendor-contracts/{v.pk}/").json()
        assert privileged.get(f"{API}/vendor-contracts/{v.pk}/").json()["total_value_usd"] == 7000

    def test_writing_a_value_without_the_permission_is_403(self, manager):
        owner = ClientFactory()
        response = manager.post(f"{API}/client-contracts/", payload(owner, value_usd=1))
        assert response.status_code == 403
        assert not ClientContract.objects.exists()
        row = ClientContractFactory(value_usd=10)
        assert (
            manager.patch(f"{API}/client-contracts/{row.pk}/", {"value_usd": 1}).status_code == 403
        )
        row.refresh_from_db()
        assert row.value_usd == 10

    def test_an_unprivileged_writer_edits_other_fields_without_touching_the_value(self, manager):
        row = ClientContractFactory(value_usd=10)
        assert (
            manager.patch(f"{API}/client-contracts/{row.pk}/", {"title": "New"}).status_code == 200
        )
        row.refresh_from_db()
        assert (row.title, row.value_usd) == ("New", 10)

    @pytest.mark.parametrize(
        "query",
        ["?value_usd=1", "?value_usd__gte=1", "?ordering=value_usd", "?ordering=-value_usd"],
    )
    def test_the_value_cannot_be_used_to_filter_or_order(self, reader, query):
        ClientContractFactory(value_usd=10)
        assert reader.get(f"{API}/client-contracts/{query}").status_code == 403

    def test_vendor_contract_value_is_blocked_the_same_way(self, reader):
        assert reader.get(f"{API}/vendor-contracts/?ordering=total_value_usd").status_code == 403

    def test_a_privileged_user_can_set_and_read_the_value(self, privileged):
        owner = ClientFactory()
        created = privileged.post(f"{API}/client-contracts/", payload(owner, value_usd=1234))
        assert created.status_code == 201, created.content
        assert created.json()["value_usd"] == 1234 and created.json()["currency"] == "USD"


class TestStatus:
    def test_create_accepts_draft_and_active_only(self, manager):
        owner = ClientFactory()
        ok = manager.post(
            f"{API}/client-contracts/", payload(owner, status="Active", effective_date=str(day(-1)))
        )
        assert ok.status_code == 201, ok.content
        for bad in ("Terminated", "Expired", "x"):
            response = manager.post(
                f"{API}/client-contracts/", payload(owner, contract_number=f"N-{bad}", status=bad)
            )
            assert response.status_code == 400, bad

    @pytest.mark.parametrize("method", ["patch", "put"])
    def test_status_on_update_is_400_even_if_unchanged(self, manager, method):
        row = ClientContractFactory(status="Draft")
        body = (
            {"status": "Draft"}
            if method == "patch"
            else payload(row.client, contract_number=row.contract_number, status="Draft")
        )
        response = getattr(manager, method)(
            f"{API}/client-contracts/{row.pk}/", body, format="json"
        )
        assert response.status_code == 400
        assert "status" in str(response.json())

    def test_the_reported_status_is_derived(self, reader):
        expired = ClientContractFactory(
            status="Active",
            activated_at=timezone.now(),
            effective_date=day(-30),
            expiry_date=day(-1),
        )
        live = ClientContractFactory(
            status="Active",
            activated_at=timezone.now(),
            effective_date=day(-30),
            expiry_date=day(0),
        )
        assert reader.get(f"{API}/client-contracts/{expired.pk}/").json()["status"] == "Expired"
        assert reader.get(f"{API}/client-contracts/{live.pk}/").json()["status"] == "Active"

    def test_status_filters_are_exact_complements(self, reader):
        ClientContractFactory(status="Draft")
        ClientContractFactory(status="Terminated")
        for end in (day(-1), day(0), day(1), None):
            ClientContractFactory(
                status="Active",
                activated_at=timezone.now(),
                effective_date=day(-30),
                expiry_date=end,
            )

        def ids(status):
            body = reader.get(f"{API}/client-contracts/?status={status}&page_size=100").json()
            return {r["id"] for r in body["results"]}

        everything = {str(pk) for pk in ClientContract.objects.values_list("pk", flat=True)}
        active, expired = ids("Active"), ids("Expired")
        draft, terminated = ids("Draft"), ids("Terminated")
        assert len(active) == 3 and len(expired) == 1 and len(draft) == 1 and len(terminated) == 1
        parts = [active, expired, draft, terminated]
        assert set().union(*parts) == everything
        assert sum(len(p) for p in parts) == len(everything)  # no row is in two buckets

    def test_an_unknown_status_filter_is_400(self, reader):
        assert reader.get(f"{API}/client-contracts/?status=Bogus").status_code == 400


class TestActions:
    def test_activate_then_terminate(self, manager):
        row = ClientContractFactory(effective_date=day(-1), expiry_date=day(30))
        activated = manager.post(f"{API}/client-contracts/{row.pk}/activate/")
        assert activated.status_code == 200 and activated.json()["status"] == "Active"
        assert activated.json()["activated_at"]
        terminated = manager.post(f"{API}/client-contracts/{row.pk}/terminate/")
        assert terminated.status_code == 200 and terminated.json()["status"] == "Terminated"
        assert terminated.json()["expiry_date"] == str(TODAY)

    def test_an_illegal_transition_is_409(self, manager):
        row = ClientContractFactory(status="Terminated")
        response = manager.post(f"{API}/client-contracts/{row.pk}/activate/")
        assert response.status_code == 409 and code_of(response) == "invalid_transition"

    def test_edits_to_a_terminated_contract_are_409(self, manager):
        row = ClientContractFactory(status="Terminated")
        response = manager.patch(f"{API}/client-contracts/{row.pk}/", {"title": "x"})
        assert response.status_code == 409 and code_of(response) == "invalid_transition"

    def test_overlap_is_409_contract_overlap(self, manager):
        owner = ClientFactory()
        ClientContractFactory(
            client=owner,
            type="MSA",
            status="Active",
            activated_at=timezone.now(),
            effective_date=day(0),
            expiry_date=day(10),
        )
        response = manager.post(
            f"{API}/client-contracts/",
            payload(
                owner,
                type="MSA",
                status="Active",
                contract_number="MSA-2",
                effective_date=str(day(10)),
            ),
        )
        assert response.status_code == 409 and code_of(response) == "contract_overlap"

    def test_adjust_end_date_corrects_an_elapsed_contract(self, manager):
        row = ClientContractFactory(
            status="Active",
            activated_at=timezone.now(),
            effective_date=day(-90),
            expiry_date=day(-5),
        )
        response = manager.post(
            f"{API}/client-contracts/{row.pk}/adjust-end-date/", {"expiry_date": str(day(-40))}
        )
        assert response.status_code == 200, response.content
        assert response.json()["expiry_date"] == str(day(-40))
        assert response.json()["status"] == "Expired"

    def test_adjust_end_date_cannot_revive(self, manager):
        row = ClientContractFactory(
            status="Active",
            activated_at=timezone.now(),
            effective_date=day(-90),
            expiry_date=day(-5),
        )
        response = manager.post(
            f"{API}/client-contracts/{row.pk}/adjust-end-date/", {"expiry_date": str(day(30))}
        )
        assert response.status_code == 400

    def test_adjust_end_date_needs_the_field(self, manager):
        row = ClientContractFactory(
            status="Terminated", activated_at=timezone.now(), effective_date=day(-10)
        )
        assert (
            manager.post(f"{API}/client-contracts/{row.pk}/adjust-end-date/", {}).status_code == 400
        )

    def test_unmapped_actions_do_not_exist(self, manager):
        row = ClientContractFactory()
        assert manager.post(f"{API}/client-contracts/{row.pk}/expire/").status_code == 404

    def test_vendor_contracts_expose_the_same_actions(self, manager):
        vendor = VendorFactory()
        created = manager.post(
            f"{API}/vendor-contracts/",
            {
                "vendor": str(vendor.pk),
                "contract_number": "V-1",
                "title": "T",
                "type": "MSA",
                "status": "Draft",
                "effective_date": str(day(-1)),
            },
        )
        assert created.status_code == 201, created.content
        pk = created.json()["id"]
        assert manager.post(f"{API}/vendor-contracts/{pk}/activate/").json()["status"] == "Active"
        assert (
            manager.post(f"{API}/vendor-contracts/{pk}/terminate/").json()["status"] == "Terminated"
        )


class TestDelete:
    def test_soft_delete_and_restore(self, manager):
        row = ClientContractFactory()
        assert manager.delete(f"{API}/client-contracts/{row.pk}/").status_code == 204
        assert manager.get(f"{API}/client-contracts/{row.pk}/").status_code == 404
        assert manager.post(f"{API}/client-contracts/{row.pk}/restore/").status_code == 200

    def test_the_owner_cannot_be_changed(self, manager):
        row = ClientContractFactory()
        response = manager.patch(
            f"{API}/client-contracts/{row.pk}/", {"client": str(ClientFactory().pk)}
        )
        assert response.status_code == 400
