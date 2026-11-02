"""CR-35: bulk-update applies the fields of a wrapped item and no longer answers "updated" to an item that changed nothing."""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import UserFactory
from apps.production.models import ProjectMembership
from apps.production.tests.factories import AssetFactory, ProjectFactory, ShotFactory

pytestmark = pytest.mark.django_db

API = "/api/v1"
KINDS = ("shots", "assets")


@pytest.fixture
def project(staff_user):
    project = ProjectFactory.create(code="CR35")
    ProjectMembership.objects.get_or_create(
        user=staff_user, project=project, defaults={"status": "active", "role": "Lead"}
    )
    return project


def record(kind, project, **extra):
    return (ShotFactory if kind == "shots" else AssetFactory).create(project=project, **extra)


def bulk(client, kind, *items):
    response = client.post(f"{API}/{kind}/bulk-update/", {"items": list(items)}, format="json")
    assert response.status_code == 200, response.content
    return response.json()


@pytest.mark.parametrize("kind", KINDS)
class TestTheFieldsAreApplied:
    def test_fields_wrapped_in_data_are_applied(self, staff_client, project, kind):
        row = record(kind, project)
        body = bulk(staff_client, kind, {"id": str(row.pk), "data": {"description": "Wrapped"}})
        assert body["successful"] == 1 and body["failed"] == 0
        row.refresh_from_db()
        assert row.description == "Wrapped"

    def test_fields_beside_the_id_still_work(self, staff_client, project, kind):
        row = record(kind, project)
        body = bulk(staff_client, kind, {"id": str(row.pk), "description": "Flat"})
        assert body["successful"] == 1
        row.refresh_from_db()
        assert row.description == "Flat"

    def test_when_both_are_given_the_wrapped_fields_win(self, staff_client, project, kind):
        row = record(kind, project)
        bulk(
            staff_client,
            kind,
            {"id": str(row.pk), "description": "Flat", "data": {"description": "Wrapped"}},
        )
        row.refresh_from_db()
        assert row.description == "Wrapped"

    def test_the_ids_and_changes_shape_still_works(self, staff_client, project, kind):
        first, second = record(kind, project), record(kind, project)
        response = staff_client.post(
            f"{API}/{kind}/bulk-update/",
            {"ids": [str(first.pk), str(second.pk)], "changes": {"description": "Both"}},
            format="json",
        )
        assert response.status_code == 200 and response.json()["successful"] == 2
        for row in (first, second):
            row.refresh_from_db()
            assert row.description == "Both"

    def test_the_other_rules_still_apply_to_wrapped_fields(self, staff_client, project, kind):
        row = record(kind, project)
        stranger = UserFactory.create()
        refused = bulk(
            staff_client, kind, {"id": str(row.pk), "data": {"assigned_artist": str(stranger.pk)}}
        )
        assert refused["failed"] == 1
        row.refresh_from_db()
        assert row.assigned_artist_id is None
        member = UserFactory.create()
        ProjectMembership.objects.create(
            user=member, project=project, status="active", role="Artist"
        )
        accepted = bulk(
            staff_client, kind, {"id": str(row.pk), "data": {"assigned_artist": str(member.pk)}}
        )
        assert accepted["successful"] == 1
        row.refresh_from_db()
        assert row.assigned_artist_id == member.pk


@pytest.mark.parametrize("kind", KINDS)
class TestAnItemThatChangesNothingIsRefused:
    @pytest.mark.parametrize(
        "extra",
        [{}, {"data": {}}, {"colour": "red"}, {"data": {"colour": "red"}}, {"data": "text"}],
        ids=[
            "only an id",
            "empty data",
            "unknown field",
            "unknown field wrapped",
            "data that is not an object",
        ],
    )
    def test_it_is_reported_invalid_not_updated(self, staff_client, project, kind, extra):
        row = record(kind, project)
        before = type(row).objects.get(pk=row.pk).updated_at
        body = bulk(staff_client, kind, {"id": str(row.pk), **extra})
        assert body["failed"] == 1 and body["successful"] == 0
        assert "no field that can be updated" in str(body["results"][0]).lower()
        assert type(row).objects.get(pk=row.pk).updated_at == before

    def test_one_empty_item_does_not_stop_the_others(self, staff_client, project, kind):
        good, empty = record(kind, project), record(kind, project)
        body = bulk(
            staff_client,
            kind,
            {"id": str(good.pk), "data": {"description": "Changed"}},
            {"id": str(empty.pk)},
        )
        assert body["successful"] == 1 and body["failed"] == 1
        good.refresh_from_db()
        assert good.description == "Changed"
