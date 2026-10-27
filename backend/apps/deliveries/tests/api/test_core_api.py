"""The delivery endpoints after Phase 6: passcode closed, PATCH working, server-made items and QC."""

from __future__ import annotations

import pytest

from apps.deliveries.models import DeliveryPackage
from apps.deliveries.tests.helpers import (
    make_package,
    package_with_items,
    prepared_package,
    published_version,
)
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/deliveries/"
PASSCODE = "TOPSECRET-PASSCODE-77"


def _body(response):
    return response.json()


class TestCreate:
    def test_a_blank_code_is_numbered_and_the_id_is_returned(self, staff_client):
        project = ProjectFactory.create(code="APIC")

        response = staff_client.post(
            URL, {"name": "Turnover", "project_id": str(project.pk)}, format="json"
        )

        assert response.status_code == 201
        assert response.json()["code"] == "DLV-APIC-0001"
        assert response.json()["id"]

    def test_the_frontends_own_code_still_works(self, staff_client):
        response = staff_client.post(
            URL,
            {"name": "Turnover", "code": "DEL-20261027-AB12", "delivery_method": "Aspera"},
            format="json",
        )

        assert response.status_code == 201 and response.json()["code"] == "DEL-20261027-AB12"

    def test_a_used_code_is_a_400_in_any_case(self, staff_client):
        staff_client.post(URL, {"name": "a", "code": "ABC-1"}, format="json")

        assert (
            staff_client.post(URL, {"name": "b", "code": "abc-1"}, format="json").status_code == 400
        )

    def test_an_unknown_project_or_client_is_a_400_not_a_500(self, staff_client):
        unknown = "00000000-0000-0000-0000-000000000000"

        assert (
            staff_client.post(
                URL, {"name": "a", "code": "X-1", "project_id": unknown}, format="json"
            ).status_code
            == 400
        )
        assert (
            staff_client.post(
                URL, {"name": "a", "code": "X-2", "client_id": unknown}, format="json"
            ).status_code
            == 400
        )
        assert DeliveryPackage.objects.count() == 0

    def test_a_blank_code_without_a_project_is_a_400(self, staff_client):
        assert staff_client.post(URL, {"name": "a"}, format="json").status_code == 400


class TestThePasscodeIsNeverReturned:
    def _make(self, staff_client):
        project = ProjectFactory.create(code="PASSP")
        created = staff_client.post(
            URL,
            {"name": "Locked", "project_id": str(project.pk), "passcode": PASSCODE},
            format="json",
        )
        assert created.status_code == 201
        return created

    def test_not_in_the_create_answer_nor_anywhere_after(self, staff_client):
        created = self._make(staff_client)
        delivery_id = created.json()["id"]
        texts = [
            created.content.decode(),
            staff_client.get(URL).content.decode(),
            staff_client.get(f"{URL}{delivery_id}/").content.decode(),
            staff_client.patch(
                f"{URL}{delivery_id}/", {"name": "Renamed"}, format="json"
            ).content.decode(),
        ]

        for text in texts:
            assert PASSCODE not in text
            assert '"passcode"' not in text

    def test_the_detail_says_whether_one_is_set(self, staff_client):
        delivery_id = self._make(staff_client).json()["id"]
        bare = make_package(code="NOPASS-1")

        assert staff_client.get(f"{URL}{delivery_id}/").json()["has_passcode"] is True
        assert staff_client.get(f"{URL}{bare.pk}/").json()["has_passcode"] is False

    def test_it_cannot_be_found_by_searching(self, staff_client):
        self._make(staff_client)

        found = staff_client.get(URL, {"search": PASSCODE}).json()["results"]

        assert found == []

    def test_it_can_still_be_set_and_changed(self, staff_client):
        delivery_id = self._make(staff_client).json()["id"]

        staff_client.patch(f"{URL}{delivery_id}/", {"passcode": "NEW-ONE"}, format="json")

        assert DeliveryPackage.objects.get(pk=delivery_id).passcode == "NEW-ONE"

    def test_it_is_not_in_the_admin_search_or_form(self, client):
        from django.contrib import admin
        from django.urls import reverse

        from apps.identity.tests.factories import UserFactory

        package = make_package(code="ADM-1", passcode=PASSCODE)
        client.force_login(UserFactory.create(is_superuser=True, is_staff=True))
        model_admin = admin.site._registry[DeliveryPackage]

        assert "passcode" not in model_admin.search_fields
        page = client.get(reverse("admin:deliveries_deliverypackage_change", args=[package.pk]))
        assert page.status_code == 200 and PASSCODE not in page.content.decode()
        found = client.get(reverse("admin:deliveries_deliverypackage_changelist"), {"q": PASSCODE})
        assert "ADM-1" not in found.content.decode()


class TestEditing:
    def test_patch_and_put_work_and_answer_with_the_detail(self, staff_client):
        package = make_package(code="PATCH-1")

        patched = staff_client.patch(
            f"{URL}{package.pk}/", {"name": "New name", "notes": "n"}, format="json"
        )
        put = staff_client.put(f"{URL}{package.pk}/", {"name": "Via PUT"}, format="json")

        assert (patched.status_code, put.status_code) == (200, 200)
        assert patched.json()["name"] == "New name" and "versions" in patched.json()

    @pytest.mark.parametrize(
        ("field", "value"),
        [("status", "Approved"), ("code", "OTHER-1"), ("client_status", "Approved"),
         ("total_size_bytes", 99), ("manifest_data", {"x": 1}), ("is_archived", True)],
    )  # fmt: skip
    def test_the_status_code_totals_and_manifest_cannot_be_written(
        self, staff_client, field, value
    ):
        package = package_with_items(code="RO-1")

        response = staff_client.patch(f"{URL}{package.pk}/", {field: value}, format="json")

        assert response.status_code == 400 and "Cannot be set directly" in response.content.decode()
        fresh = DeliveryPackage.objects.get(pk=package.pk)
        assert (fresh.status, fresh.code, fresh.is_archived) == ("Draft", "RO-1", False)

    def test_a_full_put_of_what_was_read_is_accepted(self, staff_client):
        package = prepared_package(code="ECHO-1")
        read = staff_client.get(f"{URL}{package.pk}/").json()

        response = staff_client.put(f"{URL}{package.pk}/", read, format="json")

        assert response.status_code == 200, response.content
        assert DeliveryPackage.objects.get(pk=package.pk).status == "Prepared"

    def test_a_sent_delivery_cannot_be_edited(self, staff_client):
        package = prepared_package(code="SENT-1")
        staff_client.post(f"{URL}{package.pk}/submit/", {}, format="json")

        response = staff_client.patch(f"{URL}{package.pk}/", {"name": "x"}, format="json")

        assert response.status_code == 409 and "delivery_not_editable" in response.content.decode()


class TestItems:
    def test_add_version_answers_201_with_the_items_and_their_files(self, staff_client):
        package = make_package(code="ITEMS-1")
        version = published_version(package.project, files=2)

        response = staff_client.post(
            f"{URL}{package.pk}/add-version/", {"version_id": str(version.pk)}, format="json"
        )

        assert response.status_code == 201
        item = response.json()["versions"][0]
        assert item["uid"] and item["id"]
        assert [f["role"] for f in item["files"]] == ["main", "proxy"]
        assert item["files"][0]["frozen_at"] is None
        assert "sha256" in item["files"][0]

    @pytest.mark.parametrize(
        ("build", "reason"),
        [
            (lambda p: published_version(p, published=False, files=0), "not_published"),
            (lambda p: published_version(p, files=0), "no_registered_files"),
            (lambda p: published_version(ProjectFactory.create(code="FOR1")), "unknown_version"),
        ],
    )
    def test_an_undeliverable_version_is_a_400_with_a_reason(self, staff_client, build, reason):
        package = make_package(code=f"R-{reason[:6]}")
        version = build(package.project)

        response = staff_client.post(
            f"{URL}{package.pk}/add-version/", {"version_id": str(version.pk)}, format="json"
        )

        assert response.status_code == 400
        assert reason in response.content.decode()
        assert package.versions.count() == 0  # pyright: ignore[reportAttributeAccessIssue]

    def test_an_unknown_or_malformed_version_id_is_a_400_never_a_500(self, staff_client):
        package = make_package(code="UNK-1")

        for value in ("00000000-0000-0000-0000-000000000000", "not-a-uuid"):
            response = staff_client.post(
                f"{URL}{package.pk}/add-version/", {"version_id": value}, format="json"
            )
            assert response.status_code == 400

    def test_remove_by_uid_or_by_the_older_integer(self, staff_client):
        package = package_with_items(items=2, code="REM-1")
        first, second = package.versions.order_by("pk")

        by_uid = staff_client.post(
            f"{URL}{package.pk}/remove-version/", {"item_id": str(first.uid)}, format="json"
        )
        by_int = staff_client.post(
            f"{URL}{package.pk}/remove-version/", {"version_ref_id": second.pk}, format="json"
        )

        assert (by_uid.status_code, by_int.status_code) == (200, 200)
        assert package.versions.count() == 0

    def test_remove_needs_one_of_the_ids(self, staff_client):
        package = package_with_items(code="REM-2")

        assert (
            staff_client.post(f"{URL}{package.pk}/remove-version/", {}, format="json").status_code
            == 400
        )

    def test_the_totals_are_summed_from_the_items(self, staff_client):
        package = package_with_items(items=2, code="TOT-1")
        # the stored columns are deprecated and no longer maintained
        assert DeliveryPackage.objects.get(pk=package.pk).total_size_bytes == 0

        detail = staff_client.get(f"{URL}{package.pk}/").json()
        listed = next(
            r for r in staff_client.get(URL).json()["results"] if r["id"] == str(package.pk)
        )

        assert detail["total_size_bytes"] == listed["total_size_bytes"] == 2000
        assert detail["total_frames"] == listed["total_frames"] == 0


class TestActions:
    def test_validate_reports_the_checks(self, staff_client):
        package = package_with_items(code="VAL-1")

        body = staff_client.post(f"{URL}{package.pk}/validate/", {}, format="json").json()

        assert body["success"] is True and body["all_valid"] is True
        assert body["status"] == "Validating"
        item = body["validation_results"][0]
        assert item["status"] == "valid"
        assert {c["check"] for c in item["checks"]} >= {
            "version_published",
            "files_present",
            "checksum_ok",
        }
        assert body["package_checks"] == [{"check": "has_items", "outcome": "pass", "detail": ""}]

    def test_validate_of_an_empty_delivery_says_invalid_not_valid(self, staff_client):
        package = make_package(code="VAL-2")

        body = staff_client.post(f"{URL}{package.pk}/validate/", {}, format="json").json()

        assert body["all_valid"] is False

    def test_prepare_fails_with_the_checks_when_qc_does(self, staff_client):
        package = make_package(code="PREP-1")

        response = staff_client.post(f"{URL}{package.pk}/prepare/", {}, format="json")

        assert response.status_code == 409
        text = response.content.decode()
        assert "qc_failed" in text and "has_items" in text

    def test_prepare_then_submit(self, staff_client):
        package = package_with_items(code="FLOW-1")

        prepared = staff_client.post(f"{URL}{package.pk}/prepare/", {}, format="json").json()
        sent = staff_client.post(
            f"{URL}{package.pk}/submit/", {"transfer_reference": "ASP-9"}, format="json"
        )

        assert prepared["status"] == "Ready" and len(prepared["checksums"]["manifest_sha256"]) == 64
        assert sent.status_code == 200 and sent["X-Background-Job"]
        body = sent.json()
        assert (
            body["status"] == "Submitted"
            and body["submission_result"]["transfer_reference"] == "ASP-9"
        )
        detail = staff_client.get(f"{URL}{package.pk}/").json()
        assert detail["sent_at"] and detail["transfer_reference"] == "ASP-9"
        assert detail["versions"][0]["files"][0]["frozen_at"]

    def test_submitting_twice_is_a_409_and_changes_nothing(self, staff_client):
        package = prepared_package(code="TWICE-1")
        first = staff_client.post(f"{URL}{package.pk}/submit/", {}, format="json")
        sent_at = DeliveryPackage.objects.get(pk=package.pk).sent_at

        second = staff_client.post(f"{URL}{package.pk}/submit/", {}, format="json")

        assert first.status_code == 200 and second.status_code == 409
        assert "invalid_transition" in second.content.decode()
        assert DeliveryPackage.objects.get(pk=package.pk).sent_at == sent_at

    def test_submitting_a_delivery_that_was_not_prepared_is_a_409(self, staff_client):
        package = package_with_items(code="DRAFT-SEND")

        assert staff_client.post(f"{URL}{package.pk}/submit/", {}, format="json").status_code == 409

    def test_an_item_cannot_be_added_after_the_send(self, staff_client):
        package = prepared_package(code="LATE-1")
        staff_client.post(f"{URL}{package.pk}/submit/", {}, format="json")
        version = published_version(package.project)

        response = staff_client.post(
            f"{URL}{package.pk}/add-version/", {"version_id": str(version.pk)}, format="json"
        )

        assert response.status_code == 409
