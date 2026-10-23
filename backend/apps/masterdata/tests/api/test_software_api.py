"""HTTP contract of software and nested versions (CONTRACTS §3.4, API-MD-*)."""

from __future__ import annotations

import datetime

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.constants.permissions import (
    MasterdataPermissions,
    PlatformMasterDataPermissions,
)
from apps.masterdata.models import Software, SoftwareVersion
from apps.masterdata.tests.factories import SoftwareFactory, SoftwareVersionFactory

pytestmark = pytest.mark.django_db

SW = "/api/v1/platform/master-data/software"


def versions_url(software, suffix=""):
    return f"{SW}/{software.pk}/versions{suffix}"


def client_for(*codes: str) -> APIClient:
    user = UserFactory.create()
    if codes:
        grant_permissions(user, *codes)
    client = APIClient(raise_request_exception=False)
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def anon():
    return APIClient(raise_request_exception=False)


@pytest.fixture
def reader():
    return client_for()


@pytest.fixture
def manager():
    return client_for(MasterdataPermissions.CATALOG_MANAGE)


@pytest.fixture
def hard_manager():
    return client_for(MasterdataPermissions.CATALOG_MANAGE, MasterdataPermissions.HARD_DELETE)


def error_code(response) -> str:
    return response.json()["error"]["code"]


class TestSoftwareAuthorization:
    def test_anonymous_is_refused(self, anon):
        row = SoftwareFactory()
        assert anon.get(SW).status_code == 401
        assert anon.post(SW, {"code": "x", "name": "X"}, format="json").status_code == 401
        assert anon.delete(f"{SW}/{row.pk}").status_code == 401

    def test_reader_can_read_but_not_write(self, reader):
        row = SoftwareFactory()
        assert reader.get(SW).status_code == 200
        assert reader.get(f"{SW}/{row.pk}").status_code == 200
        assert reader.post(SW, {"code": "x", "name": "X"}, format="json").status_code == 403
        assert reader.patch(f"{SW}/{row.pk}", {"name": "n"}, format="json").status_code == 403
        assert reader.post(f"{SW}/{row.pk}/archive").status_code == 403
        assert reader.post(f"{SW}/{row.pk}/restore").status_code == 403
        assert reader.delete(f"{SW}/{row.pk}").status_code == 403
        assert (
            reader.post(f"{SW}/reorder", {"ids": [str(row.pk)]}, format="json").status_code == 403
        )

    def test_manager_and_legacy_grant_can_write(self, manager):
        assert manager.post(SW, {"code": "maya", "name": "Maya"}, format="json").status_code == 201
        legacy = client_for(PlatformMasterDataPermissions.CONFIGURE)
        assert legacy.post(SW, {"code": "nuke", "name": "Nuke"}, format="json").status_code == 201

    def test_hard_delete_needs_its_own_grant(self, manager):
        row = SoftwareFactory()
        manager.delete(f"{SW}/{row.pk}")
        assert manager.delete(f"{SW}/{row.pk}?hard=true").status_code == 403


class TestVersionAuthorization:
    def test_anonymous_is_refused(self, anon):
        software = SoftwareFactory()
        assert anon.get(versions_url(software)).status_code == 401
        assert anon.post(versions_url(software), {"version": "1"}, format="json").status_code == 401

    def test_reader_can_read_but_not_write(self, reader):
        version = SoftwareVersionFactory()
        software = version.software
        assert reader.get(versions_url(software)).status_code == 200
        assert reader.get(versions_url(software, f"/{version.pk}")).status_code == 200
        assert (
            reader.post(versions_url(software), {"version": "9"}, format="json").status_code == 403
        )
        assert (
            reader.patch(
                versions_url(software, f"/{version.pk}"), {"version_code": "x"}, format="json"
            ).status_code
            == 403
        )
        assert reader.post(versions_url(software, f"/{version.pk}/archive")).status_code == 403
        assert reader.delete(versions_url(software, f"/{version.pk}")).status_code == 403


class TestSoftwareReads:
    def test_version_count_counts_live_non_archived_versions(self, reader):
        software = SoftwareFactory()
        SoftwareVersionFactory(software=software)
        SoftwareVersionFactory(software=software)
        SoftwareVersionFactory(software=software, status="archived")
        SoftwareVersionFactory(software=software).delete()

        body = reader.get(f"{SW}/{software.pk}").json()

        assert body["version_count"] == 2
        assert reader.get(SW).json()[0]["version_count"] == 2

    def test_the_list_costs_the_same_number_of_queries_for_3_or_30_rows(self, reader):
        """AUDIT P09: one query per row used to be issued for version_count."""
        for _ in range(3):
            SoftwareVersionFactory()
        with CaptureQueriesContext(connection) as few:
            reader.get(SW)
        for _ in range(27):
            SoftwareVersionFactory()
        with CaptureQueriesContext(connection) as many:
            response = reader.get(SW)

        assert len(response.json()) == 30
        assert len(many) == len(few)

    def test_soft_deleted_software_is_hidden_and_not_counted_by_the_overview(self, reader):
        keep, gone = SoftwareFactory(), SoftwareFactory()
        gone.delete()
        assert [r["id"] for r in reader.get(SW).json()] == [str(keep.pk)]
        assert reader.get(f"{SW}/{gone.pk}").status_code == 404
        assert reader.get("/api/v1/platform/overview").json()["global_software_count"] == 1


class TestSoftwareWrites:
    def test_create_returns_the_row_with_a_zero_version_count(self, manager):
        response = manager.post(
            SW, {"code": "maya", "name": "Maya", "publisher": "Autodesk"}, format="json"
        )
        assert response.status_code == 201, response.content
        body = response.json()
        assert (
            body["version_count"] == 0 and body["is_system"] is False and body["scope"] == "GLOBAL"
        )

    def test_duplicate_code_is_a_400_and_organization_scope_is_refused(self, manager):
        SoftwareFactory(code="maya", name="Maya")
        dup = manager.post(SW, {"code": "MAYA", "name": "Other"}, format="json")
        assert dup.status_code == 400 and "code" in dup.json()
        scoped = manager.post(
            SW, {"code": "x", "name": "X", "scope": "ORGANIZATION"}, format="json"
        )
        assert scoped.status_code == 400 and "scope" in scoped.json()

    def test_a_bad_website_is_a_400(self, manager):
        assert (
            manager.post(
                SW, {"code": "x", "name": "X", "website": "ftp://x"}, format="json"
            ).status_code
            == 400
        )

    def test_patch_keeps_the_version_count(self, manager):
        version = SoftwareVersionFactory()
        body = manager.patch(
            f"{SW}/{version.software.pk}", {"publisher": "Foundry"}, format="json"
        ).json()
        assert body["publisher"] == "Foundry" and body["version_count"] == 1

    def test_status_on_patch_is_refused_and_the_system_flag_is_ignored(self, manager):
        row = SoftwareFactory()
        refused = manager.patch(f"{SW}/{row.pk}", {"status": "archived"}, format="json")
        assert refused.status_code == 400 and "status" in refused.json()
        manager.patch(f"{SW}/{row.pk}", {"is_system": True}, format="json")
        row.refresh_from_db()
        assert (row.status, row.is_system) == ("active", False)

    def test_reorder(self, manager):
        a, b = SoftwareFactory(), SoftwareFactory()
        response = manager.post(f"{SW}/reorder", {"ids": [str(b.pk), str(a.pk)]}, format="json")
        assert response.status_code == 200
        assert [r["id"] for r in manager.get(SW).json()] == [str(b.pk), str(a.pk)]


class TestNestedVersionCreate:
    def test_a_version_can_be_created_under_its_software(self, manager):
        """AUDIT P01: this endpoint used to fail with 409 for every request."""
        software = SoftwareFactory(code="maya", name="Maya")

        response = manager.post(versions_url(software), {"version": "2025"}, format="json")

        assert response.status_code == 201, response.content
        body = response.json()
        assert body["code"] == "maya-2025" and body["name"] == "Maya 2025"
        assert body["software_id"] == str(software.pk) and body["is_deprecated"] is False
        assert SoftwareVersion.objects.get(pk=body["id"]).software_id == software.pk

    def test_the_software_in_the_body_is_ignored(self, manager):
        a, b = SoftwareFactory(), SoftwareFactory()
        response = manager.post(
            versions_url(a),
            {"version": "1", "software": str(b.pk), "software_id": str(b.pk)},
            format="json",
        )
        assert response.status_code == 201
        assert response.json()["software_id"] == str(a.pk)

    def test_duplicate_version_is_a_400_and_other_software_may_reuse_it(self, manager):
        a, b = SoftwareFactory(), SoftwareFactory()
        assert manager.post(versions_url(a), {"version": "2025A"}, format="json").status_code == 201
        dup = manager.post(versions_url(a), {"version": "2025a"}, format="json")
        assert dup.status_code == 400 and "version" in dup.json()
        assert manager.post(versions_url(b), {"version": "2025A"}, format="json").status_code == 201

    def test_bad_input(self, manager):
        software = SoftwareFactory()
        assert manager.post(versions_url(software), {}, format="json").status_code == 400
        dates = {"version": "1", "release_date": "2025-01-01", "end_of_support": "2024-01-01"}
        response = manager.post(versions_url(software), dates, format="json")
        assert response.status_code == 400 and "end_of_support" in response.json()

    def test_unknown_or_deleted_software_is_404(self, manager):
        gone = SoftwareFactory()
        gone.delete()
        assert manager.post(versions_url(gone), {"version": "1"}, format="json").status_code == 404
        assert manager.get(versions_url(gone)).status_code == 404


class TestVersionReads:
    def test_versions_are_scoped_to_their_software(self, reader):
        a, b = SoftwareFactory(), SoftwareFactory()
        mine = SoftwareVersionFactory(software=a)
        SoftwareVersionFactory(software=b)
        assert [r["id"] for r in reader.get(versions_url(a)).json()] == [str(mine.pk)]
        assert (
            reader.get(versions_url(b, f"/{mine.pk}")).status_code == 404
        )  # wrong parent in the URL

    def test_default_order_is_newest_release_first_undated_last_natural_order(self, reader):
        software = SoftwareFactory()
        for version, release in [
            ("9", None),
            ("10", None),
            ("2024", datetime.date(2024, 1, 1)),
            ("2025", datetime.date(2025, 1, 1)),
        ]:
            SoftwareVersionFactory(software=software, version=version, release_date=release)
        assert [r["version"] for r in reader.get(versions_url(software)).json()] == [
            "2025",
            "2024",
            "10",
            "9",
        ]

    def test_is_deprecated_is_reported(self, reader):
        software = SoftwareFactory()
        SoftwareVersionFactory(
            software=software, version="1", end_of_support=datetime.date(2000, 1, 1)
        )
        assert reader.get(versions_url(software)).json()[0]["is_deprecated"] is True

    def test_search_and_ordering_params(self, reader):
        software = SoftwareFactory()
        SoftwareVersionFactory(software=software, version="2024", name="Older")
        SoftwareVersionFactory(software=software, version="2025", name="Newer")
        assert [r["name"] for r in reader.get(versions_url(software) + "?search=newer").json()] == [
            "Newer"
        ]
        asc = reader.get(versions_url(software) + "?ordering=version").json()
        assert [r["version"] for r in asc] == ["2024", "2025"]


class TestVersionWrites:
    def test_update_archive_restore_delete(self, manager):
        version = SoftwareVersionFactory()
        url = versions_url(version.software, f"/{version.pk}")
        assert (
            manager.patch(url, {"version_code": "VC1"}, format="json").json()["version_code"]
            == "VC1"
        )
        archived = manager.post(url + "/archive")
        assert (
            archived.json()["data"]["status"] == "archived"
            and archived.json()["data"]["is_deprecated"] is True
        )
        assert manager.post(url + "/restore").json()["data"]["status"] == "active"
        assert manager.delete(url).json() == {
            "success": True,
            "message": "Software version soft-deleted. It can be restored.",
        }
        assert manager.get(url).status_code == 404
        assert manager.post(url + "/restore").status_code == 200
        assert manager.get(url).status_code == 200

    def test_hard_delete_flow(self, hard_manager):
        version = SoftwareVersionFactory()
        url = versions_url(version.software, f"/{version.pk}")
        live = hard_manager.delete(url + "?hard=true")
        assert live.status_code == 409 and error_code(live) == "not_soft_deleted"
        hard_manager.delete(url)
        assert hard_manager.delete(url + "?hard=true").status_code == 204
        assert not SoftwareVersion.all_objects.filter(pk=version.pk).exists()

    def test_the_software_of_a_version_cannot_be_changed(self, manager):
        version = SoftwareVersionFactory()
        other = SoftwareFactory()
        url = versions_url(version.software, f"/{version.pk}")
        manager.patch(url, {"software": str(other.pk), "software_id": str(other.pk)}, format="json")
        version.refresh_from_db()
        assert version.software_id != other.pk


class TestCascadesOverHttp:
    def test_archive_reports_the_versions_it_archived(self, manager):
        software = SoftwareFactory()
        version = SoftwareVersionFactory(software=software)
        response = manager.post(f"{SW}/{software.pk}/archive")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["status"] == "archived" and data["versions_archived"] == [str(version.pk)]
        assert data["version_count"] == 0

    def test_cascade_false_is_refused_while_versions_are_active(self, manager):
        software = SoftwareFactory()
        SoftwareVersionFactory(software=software)
        blocked = manager.post(f"{SW}/{software.pk}/archive?cascade=false")
        assert blocked.status_code == 409 and error_code(blocked) == "has_dependants"
        assert manager.post(f"{SW}/{software.pk}/archive?cascade=maybe").status_code == 400
        software.refresh_from_db()
        assert software.status == "active"

    def test_delete_and_restore_move_the_versions_with_the_software(self, manager):
        software = SoftwareFactory()
        version = SoftwareVersionFactory(software=software)
        assert manager.delete(f"{SW}/{software.pk}").json() == {
            "success": True,
            "message": "Software soft-deleted. It can be restored.",
        }
        assert manager.get(versions_url(software)).status_code == 404
        restored = manager.post(f"{SW}/{software.pk}/restore")
        assert restored.status_code == 200 and restored.json()["data"]["version_count"] == 1
        assert [r["id"] for r in manager.get(versions_url(software)).json()] == [str(version.pk)]

    def test_hard_delete_is_refused_while_version_rows_exist(self, hard_manager):
        software = SoftwareFactory()
        SoftwareVersionFactory(software=software)
        hard_manager.delete(f"{SW}/{software.pk}")
        blocked = hard_manager.delete(f"{SW}/{software.pk}?hard=true")
        assert blocked.status_code == 409 and error_code(blocked) == "has_dependants"
        assert Software.all_objects.filter(pk=software.pk).exists()

    def test_system_software_is_protected(self, manager):
        software = SoftwareFactory(is_system=True)
        for call in (
            lambda: manager.post(f"{SW}/{software.pk}/archive"),
            lambda: manager.delete(f"{SW}/{software.pk}"),
            lambda: manager.patch(f"{SW}/{software.pk}", {"code": "changed"}, format="json"),
        ):
            response = call()
            assert response.status_code == 409 and error_code(response) == "system_row_protected"
