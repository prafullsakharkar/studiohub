"""CR-36: a project member can be bound to one show (and released from it) through the members API."""

from __future__ import annotations

from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_all_known_codes
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory, ShotFactory, ShowFactory

pytestmark = pytest.mark.django_db

API = "/api/v1"


def members_url(project):
    return f"/api/organizations/projects/{project.pk}/members/"


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def project():
    return ProjectFactory.create(code="CR36")


@pytest.fixture
def show_a(project):
    return ShowFactory.create(project=project, code="SA")


@pytest.fixture
def show_b(project):
    return ShowFactory.create(project=project, code="SB")


@pytest.fixture
def admin(admin_user):
    return client_for(admin_user)


@pytest.fixture
def person():
    user = UserFactory.create()
    grant_all_known_codes(user)
    return user


def add(client, project, person, **extra):
    return client.post(members_url(project), {"user_id": str(person.pk), "role": "Artist", **extra}, format="json")


def row(project, person):
    return ProjectMembership.objects.get(project=project, user=person)


class TestBinding:
    def test_a_member_is_bound_to_a_show_on_creation(self, admin, project, person, show_a):
        response = add(admin, project, person, show=str(show_a.pk))
        assert response.status_code == 201, response.content
        body = response.json()
        assert body["show_id"] == str(show_a.pk)
        assert body["show_code"] == "SA"
        assert body["scope"] == "SHOW"
        assert row(project, person).show_id == show_a.pk

    def test_a_member_added_without_a_show_belongs_to_the_whole_project(self, admin, project, person):
        body = add(admin, project, person).json()
        assert body["show_id"] is None
        assert body["show_code"] == ""
        assert body["scope"] == "PROJECT"

    def test_adding_again_without_a_show_leaves_the_binding_alone(self, admin, project, person, show_a):
        add(admin, project, person, show=str(show_a.pk))
        again = add(admin, project, person, role="Lead")
        assert again.status_code == 200
        assert again.json()["show_id"] == str(show_a.pk)
        assert row(project, person).show_id == show_a.pk
        assert row(project, person).scope == "SHOW"

    def test_a_null_show_releases_the_member_to_the_whole_project(self, admin, project, person, show_a):
        add(admin, project, person, show=str(show_a.pk))
        released = add(admin, project, person, show=None)
        assert released.status_code == 200
        assert released.json()["show_id"] is None
        assert released.json()["scope"] == "PROJECT"
        assert row(project, person).show_id is None

    def test_a_member_is_moved_to_another_show(self, admin, project, person, show_a, show_b):
        add(admin, project, person, show=str(show_a.pk))
        moved = add(admin, project, person, show=str(show_b.pk))
        assert moved.json()["show_id"] == str(show_b.pk)
        assert row(project, person).show_id == show_b.pk

    def test_the_list_says_who_is_bound_to_what(self, admin, project, person, show_a):
        other = UserFactory.create()
        add(admin, project, person, show=str(show_a.pk))
        add(admin, project, other)
        rows = {r["user_id"]: r for r in admin.get(members_url(project)).json()["results"]}
        assert rows[str(person.pk)]["show_id"] == str(show_a.pk)
        assert rows[str(person.pk)]["show_code"] == "SA"
        assert rows[str(other.pk)]["show_id"] is None


class TestRefusals:
    def test_an_unknown_show_is_refused_and_nothing_is_stored(self, admin, project, person):
        response = add(admin, project, person, show=str(uuid4()))
        assert response.status_code == 400
        assert response.json()["show"] == ["Unknown show."]
        assert not ProjectMembership.objects.filter(project=project, user=person).exists()

    def test_another_projects_show_is_refused(self, admin, project, person):
        foreign = ShowFactory.create(project=ProjectFactory.create(code="OTHER"))
        response = add(admin, project, person, show=str(foreign.pk))
        assert response.status_code == 400
        assert response.json()["show"] == ["Unknown show."]

    def test_a_deleted_show_is_refused(self, admin, project, person, show_a):
        show_a.is_deleted = True
        show_a.save()
        response = add(admin, project, person, show=str(show_a.pk))
        assert response.status_code == 400
        assert response.json()["show"] == ["Unknown show."]

    def test_something_that_is_not_an_id_is_refused(self, admin, project, person):
        assert add(admin, project, person, show="not-an-id").status_code == 400

    def test_a_refused_show_leaves_an_existing_binding_as_it_was(self, admin, project, person, show_a):
        add(admin, project, person, show=str(show_a.pk))
        assert add(admin, project, person, show=str(uuid4())).status_code == 400
        assert row(project, person).show_id == show_a.pk

    def test_someone_who_may_not_manage_members_cannot_bind(self, project, person, show_a):
        outsider = UserFactory.create()
        grant_all_known_codes(outsider)
        ProjectMembership.objects.create(user=outsider, project=project, status="active", role="Artist")
        response = add(client_for(outsider), project, person, show=str(show_a.pk))
        assert response.status_code == 403
        assert not ProjectMembership.objects.filter(project=project, user=person).exists()


class TestRestoringADeletedMembership:
    def test_a_re_added_member_comes_back_with_the_show_it_is_given(self, admin, project, person, show_a):
        add(admin, project, person)
        gone = row(project, person)
        gone.is_deleted = True
        gone.save()
        back = add(admin, project, person, show=str(show_a.pk))
        assert back.json()["show_id"] == str(show_a.pk)
        assert ProjectMembership.objects.get(project=project, user=person).is_deleted is False

    def test_a_re_added_member_without_a_show_comes_back_to_the_whole_project(self, admin, project, person, show_a):
        add(admin, project, person, show=str(show_a.pk))
        gone = row(project, person)
        gone.is_deleted = True
        gone.save()
        back = add(admin, project, person)
        assert back.json()["show_id"] is None
        assert back.json()["scope"] == "PROJECT"


class TestWhatTheBindingDoes:
    def test_a_member_bound_through_the_api_sees_only_that_shows_records(self, admin, project, person, show_a, show_b):
        mine = ShotFactory.create(project=project, show=show_a)
        theirs = ShotFactory.create(project=project, show=show_b)
        loose = ShotFactory.create(project=project)
        add(admin, project, person)
        everything = {str(s["id"]) for s in _results(client_for(person).get(f"{API}/shots/"))}
        assert everything == {str(mine.pk), str(theirs.pk), str(loose.pk)}

        add(admin, project, person, show=str(show_a.pk))
        only = {str(s["id"]) for s in _results(client_for(person).get(f"{API}/shots/"))}
        assert only == {str(mine.pk)}

        add(admin, project, person, show=None)
        again = {str(s["id"]) for s in _results(client_for(person).get(f"{API}/shots/"))}
        assert again == {str(mine.pk), str(theirs.pk), str(loose.pk)}


def _results(response):
    assert response.status_code == 200, response.content
    body = response.json()
    return body["results"] if isinstance(body, dict) else body


class TestABoundMemberCannotManageMembers:
    """
    Members routes need FULL project access (``ProjectScopedAPIView._has_access``), so a member bound to a show gets a
    404 on them, can neither list nor add, and cannot widen anyone's binding or their own. No extra rule is needed.
    """

    def test_a_bound_project_creator_can_neither_list_nor_add(self, person, show_a):
        user = UserFactory.create()
        grant_all_known_codes(user)
        project = ProjectFactory.create(code="CR36B", created_by=user)
        own = ShowFactory.create(project=project, code="OWN")
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Lead", show=own)
        client = client_for(user)

        assert client.get(members_url(project)).status_code == 404
        assert add(client, project, person, show=str(own.pk)).status_code == 404
        released = client.post(members_url(project), {"user_id": str(user.pk), "show": None}, format="json")
        assert released.status_code == 404
        assert row(project, user).show_id == own.pk
        assert not ProjectMembership.objects.filter(project=project, user=person).exists()
