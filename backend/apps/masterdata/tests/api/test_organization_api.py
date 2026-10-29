"""HTTP contract of departments, teams, offices, positions and people (CONTRACTS §5)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.models import Profile
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.constants.permissions import MasterdataPermissions as P
from apps.masterdata.models import Department, Office, Person
from apps.masterdata.tests.factories import (
    DepartmentFactory,
    OfficeFactory,
    PersonFactory,
    PositionFactory,
    TeamFactory,
)

pytestmark = pytest.mark.django_db

API = "/api/v1"


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
    return client_for(P.DIRECTORY_MANAGE, P.PERSON_VIEW_SENSITIVE)


def code_of(response):
    return response.json()["error"]["code"]


PAYLOADS = {
    "departments": {"code": "COMP", "name": "Compositing", "department_type": "creative"},
    "positions": {"code": "SUP", "name": "Supervisor"},
    "offices": {
        "code": "LON",
        "name": "London",
        "office_type": "studio",
        "timezone": "Europe/London",
        "country": "UK",
        "city": "London",
    },
    "people": {"name": "Grace Hopper"},
}
FACTORIES = {
    "departments": DepartmentFactory,
    "teams": TeamFactory,
    "offices": OfficeFactory,
    "positions": PositionFactory,
    "people": PersonFactory,
}


@pytest.mark.parametrize("slug", list(FACTORIES))
class TestMatrix:
    def test_anonymous_is_refused(self, slug):
        assert APIClient().get(f"{API}/{slug}/").status_code == 401

    def test_a_plain_user_reads_but_cannot_write(self, reader, slug):
        row = FACTORIES[slug]()
        assert reader.get(f"{API}/{slug}/").status_code == 200
        assert reader.get(f"{API}/{slug}/{row.pk}/").status_code == 200
        assert reader.post(f"{API}/{slug}/", {"name": "x"}).status_code == 403
        assert reader.patch(f"{API}/{slug}/{row.pk}/", {"name": "y"}).status_code == 403
        assert reader.delete(f"{API}/{slug}/{row.pk}/").status_code == 403
        assert reader.post(f"{API}/{slug}/{row.pk}/restore/").status_code == 403

    def test_delete_is_soft_and_restorable(self, manager, slug):
        row = FACTORIES[slug]()
        assert manager.delete(f"{API}/{slug}/{row.pk}/").status_code == 204
        assert manager.get(f"{API}/{slug}/{row.pk}/").status_code == 404
        assert manager.post(f"{API}/{slug}/{row.pk}/restore/").status_code == 200
        assert manager.get(f"{API}/{slug}/{row.pk}/").status_code == 200

    def test_hard_delete_needs_its_own_permission(self, manager, slug):
        row = FACTORIES[slug](is_deleted=True)
        assert manager.delete(f"{API}/{slug}/{row.pk}/?hard=true").status_code == 403
        hard = client_for(P.DIRECTORY_MANAGE, P.HARD_DELETE)
        assert hard.delete(f"{API}/{slug}/{row.pk}/?hard=true").status_code == 204


@pytest.mark.parametrize("slug", list(PAYLOADS))
def test_create_and_duplicate(privileged, slug):
    first = privileged.post(f"{API}/{slug}/", PAYLOADS[slug], format="json")
    assert first.status_code == 201, first.content
    if slug == "people":
        return  # names are not unique
    again = privileged.post(f"{API}/{slug}/", PAYLOADS[slug], format="json")
    assert again.status_code == 400 and "code" in str(again.json())


class TestDepartments:
    def test_utilization_and_capacity_are_not_in_the_api(self, manager):
        row = DepartmentFactory(utilization_percentage=55, capacity_hours_weekly=200)
        body = manager.get(f"{API}/departments/{row.pk}/").json()
        assert "utilization_percentage" not in body and "capacity_hours_weekly" not in body
        manager.patch(f"{API}/departments/{row.pk}/", {"utilization_percentage": 1}, format="json")
        row.refresh_from_db()
        assert (row.utilization_percentage, row.capacity_hours_weekly) == (55, 200)  # untouched

    def test_hierarchy_errors_are_400_and_name_the_field(self, manager):
        a = DepartmentFactory()
        b = DepartmentFactory(parent=a)
        cycle = manager.patch(f"{API}/departments/{a.pk}/", {"parent": str(b.pk)}, format="json")
        assert cycle.status_code == 400 and "parent" in cycle.json()
        own = manager.patch(f"{API}/departments/{a.pk}/", {"parent": str(a.pk)}, format="json")
        assert own.status_code == 400 and "parent" in own.json()

    def test_a_department_in_use_answers_409(self, manager):
        row = DepartmentFactory()
        TeamFactory(department=row)
        response = manager.delete(f"{API}/departments/{row.pk}/")
        assert response.status_code == 409 and code_of(response) == "has_dependants"
        assert Department.objects.filter(pk=row.pk).exists()

    def test_put_replaces_the_writable_fields(self, manager):
        row = DepartmentFactory()
        response = manager.put(
            f"{API}/departments/{row.pk}/",
            {"code": row.code, "name": "Renamed", "department_type": "technical"},
            format="json",
        )
        assert response.status_code == 200, response.content
        assert response.json()["name"] == "Renamed"

    def test_filters(self, reader):
        parent = DepartmentFactory()
        DepartmentFactory(parent=parent, department_type="support")
        DepartmentFactory(department_type="creative")
        assert reader.get(f"{API}/departments/?parent={parent.pk}").json()["count"] == 1
        assert reader.get(f"{API}/departments/?department_type=support").json()["count"] == 1


class TestTeams:
    def test_the_department_is_required(self, manager):
        response = manager.post(f"{API}/teams/", {"code": "t", "name": "T"}, format="json")
        assert response.status_code == 400 and "department" in response.json()

    def test_utilization_is_not_in_the_api(self, reader):
        row = TeamFactory(utilization_percentage=70)
        assert "utilization_percentage" not in reader.get(f"{API}/teams/{row.pk}/").json()


class TestOffices:
    def test_headcount_is_computed_from_live_active_people(self, reader):
        office = OfficeFactory(headcount=999)  # a stale stored value must not leak
        PersonFactory(office=office)
        PersonFactory(office=office)
        PersonFactory(office=office, status="inactive")
        PersonFactory(office=office, is_deleted=True)
        PersonFactory()
        assert reader.get(f"{API}/offices/{office.pk}/").json()["headcount"] == 2
        listed = reader.get(f"{API}/offices/").json()["results"]
        assert [r["headcount"] for r in listed if r["id"] == str(office.pk)] == [2]

    def test_headcount_is_not_writable(self, manager):
        office = OfficeFactory()
        manager.patch(f"{API}/offices/{office.pk}/", {"headcount": 50}, format="json")
        assert manager.get(f"{API}/offices/{office.pk}/").json()["headcount"] == 0

    def test_a_new_headquarters_demotes_the_old_one(self, manager):
        old = OfficeFactory(is_headquarters=True)
        response = manager.post(
            f"{API}/offices/", {**PAYLOADS["offices"], "is_headquarters": True}, format="json"
        )
        assert response.status_code == 201, response.content
        old.refresh_from_db()
        assert old.is_headquarters is False
        assert Office.objects.filter(is_headquarters=True).count() == 1

    def test_a_bad_timezone_is_400(self, manager):
        response = manager.post(
            f"{API}/offices/", {**PAYLOADS["offices"], "timezone": "Mars/Base"}, format="json"
        )
        assert response.status_code == 400 and "timezone" in response.json()

    def test_headcount_survives_create_and_update_responses(self, manager):
        created = manager.post(f"{API}/offices/", PAYLOADS["offices"], format="json")
        assert created.status_code == 201 and created.json()["headcount"] == 0
        patched = manager.patch(
            f"{API}/offices/{created.json()['id']}/", {"city": "Leeds"}, format="json"
        )
        assert patched.status_code == 200 and patched.json()["headcount"] == 0


class TestPeople:
    def test_user_is_read_only_on_create_and_update(self, manager):
        user = UserFactory.create()
        created = manager.post(f"{API}/people/", {"name": "P", "user": str(user.pk)}, format="json")
        assert created.status_code == 201 and created.json()["user"] is None
        person = PersonFactory()
        manager.patch(f"{API}/people/{person.pk}/", {"user": str(user.pk)}, format="json")
        person.refresh_from_db()
        assert person.user_id is None

    def test_link_and_unlink(self, manager):
        person = PersonFactory(name="Old", email="old@x.io")
        user = UserFactory.create(email="ada@example.com")
        Profile.objects.create(user=user, first_name="Ada", last_name="Lovelace")
        linked = manager.post(f"{API}/people/{person.pk}/link-user/", {"user": str(user.pk)})
        assert linked.status_code == 200, linked.content
        assert linked.json()["user"] == str(user.pk)
        assert linked.json()["name"] == "Ada Lovelace"
        unlinked = manager.post(f"{API}/people/{person.pk}/unlink-user/")
        assert unlinked.status_code == 200 and unlinked.json()["user"] is None

    def test_link_needs_the_directory_permission(self, reader):
        person = PersonFactory()
        user = UserFactory.create()
        assert (
            reader.post(f"{API}/people/{person.pk}/link-user/", {"user": str(user.pk)}).status_code
            == 403
        )
        assert reader.post(f"{API}/people/{person.pk}/unlink-user/").status_code == 403

    def test_a_user_already_linked_elsewhere_is_409(self, manager):
        user = UserFactory.create()
        PersonFactory(user=user)
        response = manager.post(
            f"{API}/people/{PersonFactory().pk}/link-user/", {"user": str(user.pk)}
        )
        assert response.status_code == 409 and code_of(response) == "conflict"

    def test_an_inactive_or_unknown_user_is_400(self, manager):
        person = PersonFactory()
        off = UserFactory.create(is_active=False)
        assert (
            manager.post(f"{API}/people/{person.pk}/link-user/", {"user": str(off.pk)}).status_code
            == 400
        )
        assert (
            manager.post(
                f"{API}/people/{person.pk}/link-user/",
                {"user": "00000000-0000-4000-8000-000000000000"},
            ).status_code
            == 400
        )
        assert manager.post(f"{API}/people/{person.pk}/link-user/", {}).status_code == 400

    def test_unlinking_someone_not_linked_is_409(self, manager):
        assert manager.post(f"{API}/people/{PersonFactory().pk}/unlink-user/").status_code == 409

    def test_name_and_email_of_a_linked_person_are_read_only(self, privileged):
        user = UserFactory.create(email="ada@example.com")
        Profile.objects.create(user=user, first_name="Ada", last_name="Lovelace")
        person = PersonFactory()
        privileged.post(f"{API}/people/{person.pk}/link-user/", {"user": str(user.pk)})
        response = privileged.patch(
            f"{API}/people/{person.pk}/", {"email": "else@x.io"}, format="json"
        )
        assert response.status_code == 400 and "email" in response.json()

    def test_deactivate_reports_cleared_links(self, manager):
        person = PersonFactory()
        department = DepartmentFactory(manager=person)
        response = manager.post(f"{API}/people/{person.pk}/deactivate/")
        assert response.status_code == 200, response.content
        body = response.json()
        assert body["status"] == "inactive"
        assert body["warnings"] == [
            {"model": "masterdata.Department", "id": str(department.pk), "field": "manager"}
        ]
        department.refresh_from_db()
        assert department.manager is None

    def test_a_status_patch_reports_them_too(self, manager):
        person = PersonFactory()
        TeamFactory(lead=person)
        response = manager.patch(
            f"{API}/people/{person.pk}/", {"status": "archived"}, format="json"
        )
        assert response.status_code == 200 and len(response.json()["warnings"]) == 1

    def test_an_ordinary_patch_has_no_warnings_key(self, manager):
        person = PersonFactory()
        response = manager.patch(f"{API}/people/{person.pk}/", {"seniority": "lead"}, format="json")
        assert response.status_code == 200 and "warnings" not in response.json()

    def test_reactivate(self, manager):
        person = PersonFactory(status="inactive")
        response = manager.post(f"{API}/people/{person.pk}/reactivate/")
        assert response.status_code == 200 and response.json()["status"] == "active"

    def test_deactivate_rejects_a_bad_status(self, manager):
        person = PersonFactory()
        response = manager.post(f"{API}/people/{person.pk}/deactivate/", {"status": "draft"})
        assert response.status_code == 400

    def test_deleting_a_manager_clears_their_links(self, manager):
        person = PersonFactory()
        office = OfficeFactory(manager=person)
        assert manager.delete(f"{API}/people/{person.pk}/").status_code == 204
        office.refresh_from_db()
        assert office.manager is None
        assert not Person.objects.filter(pk=person.pk).exists()

    def test_team_department_mismatch_is_400(self, manager):
        team = TeamFactory()
        response = manager.post(
            f"{API}/people/",
            {"name": "P", "team": str(team.pk), "department": str(DepartmentFactory().pk)},
            format="json",
        )
        assert response.status_code == 400 and "team" in response.json()

    def test_a_duplicate_email_is_400_without_echoing_it(self, privileged):
        PersonFactory(email="taken@x.io")
        response = privileged.post(
            f"{API}/people/", {"name": "P", "email": "TAKEN@x.io"}, format="json"
        )
        assert response.status_code == 400 and "email" in response.json()
        assert "taken@x.io" not in response.content.decode().lower().replace('"email"', "")

    def test_unprivileged_writers_cannot_set_personal_fields(self, manager):
        response = manager.post(f"{API}/people/", {"name": "P", "email": "a@x.io"}, format="json")
        assert response.status_code == 403
