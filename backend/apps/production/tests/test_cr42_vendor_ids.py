"""CR-42: a project's vendor_ids must name live vendors, each once; vendor_names is read from the vendors."""

from __future__ import annotations

from uuid import uuid4

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.masterdata.tests.factories import VendorFactory
from apps.production.models import Project
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db

PROJECTS = "/api/v1/projects/"
UNKNOWN = uuid4()


@pytest.fixture
def admin(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def vendors():
    return [VendorFactory.create(name="Northlight"), VendorFactory.create(name="Ember FX")]


def create(client, **body):
    return client.post(
        PROJECTS, {"code": "CR42", "name": "Vendors", "type": "Feature Film", **body}, format="json"
    )


def patch(client, project, **body):
    return client.patch(f"{PROJECTS}{project.pk}/", body, format="json")


class TestWrites:
    def test_valid_ids_are_stored_in_order_and_named(self, admin, vendors):
        north, ember = vendors
        response = create(admin, vendor_ids=[str(ember.pk), str(north.pk)])
        assert response.status_code == 201, response.json()
        assert response.json()["vendor_ids"] == [str(ember.pk), str(north.pk)]
        assert response.json()["vendor_names"] == ["Ember FX", "Northlight"]
        assert Project.objects.get(code="CR42").vendor_ids == [str(ember.pk), str(north.pk)]

    def test_an_empty_list_clears_the_vendors(self, admin, vendors):
        project = ProjectFactory.create(vendor_ids=[str(vendors[0].pk)])
        response = patch(admin, project, vendor_ids=[])
        assert response.status_code == 200
        assert response.json()["vendor_ids"] == []
        assert response.json()["vendor_names"] == []

    @pytest.mark.parametrize(
        "bad, message",
        [
            (lambda v: [str(UNKNOWN)], f"Unknown vendor: {UNKNOWN}"),
            (lambda v: [str(v[0].pk), str(v[0].pk)], "Vendor listed twice: {first}"),
        ],
        ids=["unknown", "duplicate"],
    )
    def test_unknown_and_duplicate_ids_are_refused_and_change_nothing(
        self, admin, vendors, bad, message
    ):
        project = ProjectFactory.create(vendor_ids=[str(vendors[1].pk)])
        response = patch(admin, project, vendor_ids=bad(vendors))
        assert response.status_code == 400
        assert response.json()["vendor_ids"] == [message.format(first=vendors[0].pk)]
        project.refresh_from_db()
        assert project.vendor_ids == [str(vendors[1].pk)]

    def test_a_deleted_vendor_is_refused(self, admin, vendors):
        gone = vendors[0]
        gone.delete()
        response = create(admin, vendor_ids=[str(gone.pk)])
        assert response.status_code == 400
        assert not Project.objects.filter(code="CR42").exists()

    @pytest.mark.parametrize(
        "bad", [["not-a-vendor"], [{"id": "x"}], [42]], ids=["text", "object", "number"]
    )
    def test_malformed_ids_are_refused(self, admin, bad):
        response = create(admin, vendor_ids=bad)
        assert response.status_code == 400
        assert not Project.objects.filter(code="CR42").exists()

    def test_vendor_names_sent_by_a_client_is_ignored(self, admin, vendors):
        response = create(admin, vendor_ids=[str(vendors[0].pk)], vendor_names=["Somebody Else"])
        assert response.status_code == 201
        assert response.json()["vendor_names"] == ["Northlight"]


class TestReads:
    def test_names_follow_a_rename_and_skip_a_deleted_vendor(self, admin, vendors):
        north, ember = vendors
        project = ProjectFactory.create(
            vendor_ids=[str(north.pk), str(ember.pk)], vendor_names=["stale"]
        )
        north.name = "Northlight Studios"
        north.save()
        ember.delete()
        body = admin.get(f"{PROJECTS}{project.pk}/").json()
        assert body["vendor_ids"] == [str(north.pk), str(ember.pk)]
        assert body["vendor_names"] == ["Northlight Studios"]

    def test_an_older_row_with_ids_that_are_not_vendors_is_read_as_it_is(self, admin, vendors):
        project = ProjectFactory.create(vendor_ids=["NLR", str(vendors[1].pk), 42])
        body = admin.get(f"{PROJECTS}{project.pk}/").json()
        assert body["vendor_ids"] == ["NLR", str(vendors[1].pk), 42]
        assert body["vendor_names"] == ["Ember FX"]

    def test_a_list_looks_up_the_names_of_the_whole_page_in_one_query(self, admin):
        # Only the vendor lookups are counted: the page also loads each supervisor's and coordinator's profile
        # one project at a time, which is older than CR-42 and outside it.
        def vendor_queries():
            with CaptureQueriesContext(connection) as ctx:
                response = admin.get(PROJECTS)
            assert response.status_code == 200
            return sum(
                '"masterdata_vendor"' in q["sql"] for q in ctx.captured_queries
            ), response.json()

        ProjectFactory.create(code="P1", vendor_ids=[str(VendorFactory.create().pk)])
        assert vendor_queries()[0] == 1
        for n in range(2, 6):
            ProjectFactory.create(
                code=f"P{n}",
                vendor_ids=[str(VendorFactory.create().pk), str(VendorFactory.create().pk)],
            )
        count, body = vendor_queries()
        assert count == 1
        rows = body["results"] if isinstance(body, dict) else body
        assert len(rows) == 5
        assert all(len(row["vendor_names"]) == len(row["vendor_ids"]) for row in rows)
