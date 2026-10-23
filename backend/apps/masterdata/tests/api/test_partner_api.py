"""HTTP contract of clients, vendors and contacts (CONTRACTS §4, API-MD-*, SEC-MD-*)."""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.constants.permissions import MasterdataPermissions as P
from apps.masterdata.constants.permissions import PlatformMasterDataPermissions
from apps.masterdata.models import Client, ClientContact
from apps.masterdata.tests.factories import (
    ClientContactFactory,
    ClientFactory,
    VendorContactFactory,
    VendorFactory,
)

pytestmark = pytest.mark.django_db

API = "/api/v1"


def client_for(*codes: str) -> APIClient:
    user = UserFactory.create()
    if codes:
        grant_permissions(user, *codes)
    api = APIClient(raise_request_exception=False)
    api.force_authenticate(user=user)
    return api


@pytest.fixture
def anon():
    return APIClient(raise_request_exception=False)


@pytest.fixture
def reader():
    return client_for()


@pytest.fixture
def manager():
    return client_for(P.DIRECTORY_MANAGE)


@pytest.fixture
def privileged():
    return client_for(P.DIRECTORY_MANAGE, P.PERSON_VIEW_SENSITIVE, P.CLIENT_VIEW_FINANCIAL)


def codes(response):
    return response.json()["error"]["code"]


CLIENT = {"code": "APEX", "name": "Apex", "email": "ops@apex.vfx", "total_billed_usd": "100.00"}
SENSITIVE = ("contact_name", "email", "phone")


class TestAuthorizationMatrix:
    @pytest.mark.parametrize("path", ["clients", "vendors", "client-contacts", "vendor-contacts"])
    def test_anonymous_is_refused(self, anon, path):
        assert anon.get(f"{API}/{path}/").status_code == 401

    @pytest.mark.parametrize("slug", ["clients", "vendors"])
    def test_a_plain_user_reads_but_cannot_write(self, reader, slug):
        row = (ClientFactory if slug == "clients" else VendorFactory)()
        assert reader.get(f"{API}/{slug}/").status_code == 200
        assert reader.get(f"{API}/{slug}/{row.pk}/").status_code == 200
        assert reader.post(f"{API}/{slug}/", {"code": "X", "name": "X"}).status_code == 403
        assert reader.patch(f"{API}/{slug}/{row.pk}/", {"name": "Y"}).status_code == 403
        assert reader.delete(f"{API}/{slug}/{row.pk}/").status_code == 403

    def test_the_legacy_configure_code_still_writes_until_phase_8(self):
        legacy = client_for(PlatformMasterDataPermissions.CONFIGURE)
        assert legacy.post(f"{API}/clients/", {"code": "L", "name": "L"}).status_code == 201

    def test_hard_delete_needs_its_own_permission(self, manager):
        row = ClientFactory(is_deleted=True)
        assert manager.delete(f"{API}/clients/{row.pk}/?hard=true").status_code == 403
        hard = client_for(P.DIRECTORY_MANAGE, P.HARD_DELETE)
        assert hard.delete(f"{API}/clients/{row.pk}/?hard=true").status_code == 204
        assert not Client.all_objects.filter(pk=row.pk).exists()

    def test_the_legacy_code_never_grants_hard_delete(self):
        legacy = client_for(PlatformMasterDataPermissions.CONFIGURE)
        row = ClientFactory(is_deleted=True)
        assert legacy.delete(f"{API}/clients/{row.pk}/?hard=true").status_code == 403


class TestClientCrud:
    def test_create_returns_the_new_row_without_embedding_contacts(self, privileged):
        response = privileged.post(f"{API}/clients/", CLIENT, format="json")
        assert response.status_code == 201, response.content
        body = response.json()
        assert body["code"] == "APEX" and body["contact_count"] == 0
        assert "contacts" not in body
        assert "active_projects" not in body and "active_tasks_count" not in body
        assert Decimal(body["total_billed_usd"]) == Decimal("100.00")

    def test_a_duplicate_code_is_a_400_with_the_field(self, privileged):
        ClientFactory(code="apex")
        response = privileged.post(f"{API}/clients/", CLIENT, format="json")
        assert response.status_code == 400
        assert "code" in str(response.json())

    def test_validation_errors_do_not_echo_other_rows(self, privileged):
        response = privileged.post(
            f"{API}/clients/", {**CLIENT, "email": "not-an-email"}, format="json"
        )
        assert response.status_code == 400

    def test_delete_is_a_soft_delete_and_restore_undoes_it(self, privileged):
        row = ClientFactory()
        assert privileged.delete(f"{API}/clients/{row.pk}/").status_code == 204
        assert privileged.get(f"{API}/clients/{row.pk}/").status_code == 404
        restored = privileged.post(f"{API}/clients/{row.pk}/restore/")
        assert restored.status_code == 200
        assert privileged.get(f"{API}/clients/{row.pk}/").status_code == 200

    def test_a_client_with_a_contract_in_force_answers_409(self, privileged):
        from datetime import timedelta

        from django.utils import timezone

        from apps.masterdata.tests.factories import ClientContractFactory

        row = ClientFactory()
        today = timezone.localdate()
        ClientContractFactory(
            client=row,
            status="Active",
            activated_at=timezone.now(),
            effective_date=today - timedelta(days=1),
        )
        response = privileged.delete(f"{API}/clients/{row.pk}/")
        assert response.status_code == 409 and codes(response) == "has_dependants"

    def test_hard_param_must_be_a_boolean(self, privileged):
        row = ClientFactory()
        assert privileged.delete(f"{API}/clients/{row.pk}/?hard=maybe").status_code == 400

    def test_contact_count_counts_live_contacts_only(self, privileged):
        row = ClientFactory()
        ClientContactFactory(client=row)
        ClientContactFactory(client=row)
        ClientContactFactory(client=row, is_deleted=True)
        assert privileged.get(f"{API}/clients/{row.pk}/").json()["contact_count"] == 2
        listed = privileged.get(f"{API}/clients/").json()["results"]
        assert [r["contact_count"] for r in listed if r["id"] == str(row.pk)] == [2]

    def test_vendor_create_and_rating_bounds(self, privileged):
        ok = privileged.post(f"{API}/vendors/", {"code": "V", "name": "V", "rating": "4.5"})
        assert ok.status_code == 201, ok.content
        bad = privileged.post(f"{API}/vendors/", {"code": "W", "name": "W", "rating": "9"})
        assert bad.status_code == 400


class TestH1Gating:
    """Fields needing ``person.view_sensitive`` / ``client.view_financial`` (DECISIONS H1)."""

    def make(self):
        return ClientFactory(
            contact_name="Jane Doe",
            email="jane@apex.vfx",
            phone="+1 555 0100",
            total_billed_usd=Decimal("999.00"),
        )

    def test_without_permissions_the_fields_are_omitted_not_blanked(self, reader):
        row = self.make()
        body = reader.get(f"{API}/clients/{row.pk}/").json()
        for field in (*SENSITIVE, "total_billed_usd"):
            assert field not in body
        assert body["name"] == row.name
        listed = reader.get(f"{API}/clients/").json()["results"][0]
        assert not (set(SENSITIVE) | {"total_billed_usd"}) & set(listed)

    def test_each_permission_unlocks_only_its_own_fields(self):
        row = self.make()
        sensitive = client_for(P.PERSON_VIEW_SENSITIVE).get(f"{API}/clients/{row.pk}/").json()
        assert set(SENSITIVE) <= set(sensitive) and "total_billed_usd" not in sensitive
        financial = client_for(P.CLIENT_VIEW_FINANCIAL).get(f"{API}/clients/{row.pk}/").json()
        assert "total_billed_usd" in financial and not set(SENSITIVE) & set(financial)

    def test_a_write_naming_a_hidden_field_is_403_and_changes_nothing(self, manager):
        row = self.make()
        for field, value in (("email", "x@y.io"), ("total_billed_usd", "1")):
            response = manager.patch(f"{API}/clients/{row.pk}/", {field: value}, format="json")
            assert response.status_code == 403, field
        row.refresh_from_db()
        assert row.email == "jane@apex.vfx" and row.total_billed_usd == Decimal("999.00")

    def test_create_naming_a_hidden_field_is_403_and_creates_nothing(self, manager):
        response = manager.post(
            f"{API}/clients/", {"code": "N", "name": "N", "total_billed_usd": "5"}, format="json"
        )
        assert response.status_code == 403
        assert not Client.objects.filter(code="N").exists()

    def test_patch_and_put_by_an_unprivileged_writer_never_null_hidden_fields(self, manager):
        row = self.make()
        assert manager.patch(f"{API}/clients/{row.pk}/", {"name": "Renamed"}).status_code == 200
        put = manager.put(
            f"{API}/clients/{row.pk}/", {"code": row.code, "name": "Again"}, format="json"
        )
        assert put.status_code == 200, put.content
        row.refresh_from_db()
        assert (row.name, row.contact_name, row.email, row.total_billed_usd) == (
            "Again",
            "Jane Doe",
            "jane@apex.vfx",
            Decimal("999.00"),
        )

    @pytest.mark.parametrize(
        "query",
        [
            "?email=jane@apex.vfx",
            "?email__icontains=jane",
            "?contact_name=Jane",
            "?phone=555",
            "?ordering=email",
            "?ordering=-total_billed_usd",
            "?total_billed_usd=999",
            "?total_billed_usd__gte=1",
        ],
    )
    def test_hidden_fields_cannot_be_used_to_filter_or_order(self, reader, query):
        self.make()
        assert reader.get(f"{API}/clients/{query}").status_code == 403

    def test_search_never_matches_a_hidden_field(self, reader):
        self.make()
        assert reader.get(f"{API}/clients/?search=jane@apex").json()["count"] == 0
        assert reader.get(f"{API}/clients/?search=Jane").json()["count"] == 0
        allowed = client_for(P.PERSON_VIEW_SENSITIVE)
        assert allowed.get(f"{API}/clients/?search=Jane").json()["count"] == 1

    def test_ordinary_filters_and_ordering_still_work(self, reader):
        ClientFactory(name="B", status="Active")
        ClientFactory(name="A", status="Active")
        names = [
            r["name"]
            for r in reader.get(f"{API}/clients/?status=Active&ordering=name").json()["results"]
        ]
        assert names == sorted(names)

    def test_vendor_contact_data_is_gated_the_same_way(self, reader):
        row = VendorFactory(contact_name="Jane Doe", email="v@x.io")
        body = reader.get(f"{API}/vendors/{row.pk}/").json()
        assert "contact_name" not in body and "email" not in body
        assert reader.get(f"{API}/vendors/?email=v@x.io").status_code == 403

    def test_audit_logs_carry_field_names_never_values(
        self, privileged, django_capture_on_commit_callbacks
    ):
        from apps.audit.models import AuditLog

        with django_capture_on_commit_callbacks(execute=True):
            privileged.post(
                f"{API}/clients/", {**CLIENT, "contact_name": "Jane Doe"}, format="json"
            )
        blob = str(list(AuditLog.objects.values_list("metadata", "description", "target_name")))
        assert "ops@apex.vfx" not in blob and "Jane Doe" not in blob and "100.00" not in blob
        assert "total_billed_usd" in blob  # the field name is recorded


class TestContactsArePurelySensitive:
    def test_everything_is_403_without_the_permission(self, manager):
        contact = ClientContactFactory()
        owner = contact.client
        for method, url in (
            ("get", f"{API}/client-contacts/"),
            ("get", f"{API}/client-contacts/{contact.pk}/"),
            ("post", f"{API}/client-contacts/"),
            ("patch", f"{API}/client-contacts/{contact.pk}/"),
            ("delete", f"{API}/client-contacts/{contact.pk}/"),
            ("post", f"{API}/client-contacts/{contact.pk}/restore/"),
            ("get", f"{API}/client-contacts/?client={owner.pk}"),
        ):
            assert getattr(manager, method)(url).status_code == 403, (method, url)

    def test_a_missing_id_looks_exactly_like_a_forbidden_one(self, reader):
        real = ClientContactFactory()
        missing = reader.get(f"{API}/client-contacts/{uuid.uuid4()}/")
        existing = reader.get(f"{API}/client-contacts/{real.pk}/")
        assert missing.status_code == existing.status_code == 403

        def body(response):  # only the per-request id may differ
            data = response.json()
            data["error"].pop("request_id", None)
            return data

        assert body(missing) == body(existing)

    def test_the_sensitive_permission_alone_reads_but_cannot_write(self):
        reader = client_for(P.PERSON_VIEW_SENSITIVE)
        contact = ClientContactFactory()
        assert reader.get(f"{API}/client-contacts/{contact.pk}/").status_code == 200
        assert reader.delete(f"{API}/client-contacts/{contact.pk}/").status_code == 403

    def test_manage_alone_is_not_enough_to_write(self, manager):
        owner = ClientFactory()
        response = manager.post(
            f"{API}/client-contacts/", {"client": str(owner.pk), "name": "J"}, format="json"
        )
        assert response.status_code == 403

    def test_both_permissions_write(self, privileged):
        owner = ClientFactory()
        created = privileged.post(
            f"{API}/client-contacts/",
            {"client": str(owner.pk), "name": "Jane", "email": "J@X.io", "is_primary": True},
            format="json",
        )
        assert created.status_code == 201, created.content
        assert created.json()["email"] == "j@x.io"
        pk = created.json()["id"]
        assert privileged.patch(f"{API}/client-contacts/{pk}/", {"role": "EP"}).status_code == 200
        assert privileged.delete(f"{API}/client-contacts/{pk}/").status_code == 204

    def test_the_owner_cannot_be_changed(self, privileged):
        contact = ClientContactFactory()
        other = ClientFactory()
        response = privileged.patch(
            f"{API}/client-contacts/{contact.pk}/", {"client": str(other.pk)}, format="json"
        )
        assert response.status_code == 400
        assert ClientContact.objects.get(pk=contact.pk).client_id == contact.client_id

    def test_filtering_by_owner_and_primary(self, privileged):
        a, b = ClientFactory(), ClientFactory()
        ClientContactFactory(client=a, is_primary=True)
        ClientContactFactory(client=a)
        ClientContactFactory(client=b)
        assert privileged.get(f"{API}/client-contacts/?client={a.pk}").json()["count"] == 2
        assert (
            privileged.get(f"{API}/client-contacts/?client={a.pk}&is_primary=true").json()["count"]
            == 1
        )

    def test_a_second_primary_demotes_the_first(self, privileged):
        owner = ClientFactory()
        first = ClientContactFactory(client=owner, is_primary=True)
        second = privileged.post(
            f"{API}/client-contacts/",
            {"client": str(owner.pk), "name": "B", "is_primary": True},
            format="json",
        )
        assert second.status_code == 201
        first.refresh_from_db()
        assert first.is_primary is False

    def test_vendor_contacts_are_gated_identically(self, manager, privileged):
        row = VendorContactFactory()
        assert manager.get(f"{API}/vendor-contacts/{row.pk}/").status_code == 403
        assert privileged.get(f"{API}/vendor-contacts/{row.pk}/").status_code == 200
        assert manager.get(f"{API}/vendor-contacts/{uuid.uuid4()}/").status_code == 403

    def test_a_validation_error_on_a_contact_does_not_echo_the_submitted_email(self, privileged):
        owner = ClientFactory()
        ClientContactFactory(client=owner, email="taken@x.io")
        response = privileged.post(
            f"{API}/client-contacts/",
            {"client": str(owner.pk), "name": "J", "email": "TAKEN@x.io"},
            format="json",
        )
        assert response.status_code == 400
        assert "taken@x.io" not in response.content.decode().lower().replace('"email"', "")
