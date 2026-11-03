"""CR-38: adding a person who is already a member changes only what the request names."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_all_known_codes
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory, ShowFactory

pytestmark = pytest.mark.django_db

API = "/api/v1"
STATUSES = ["suspended", "on_leave", "terminated"]


def members_url(project):
    return f"/api/organizations/projects/{project.pk}/members/"


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def project():
    return ProjectFactory.create(code="CR38")


@pytest.fixture
def admin(admin_user):
    return client_for(admin_user)


@pytest.fixture
def person():
    user = UserFactory.create()
    grant_all_known_codes(user)
    return user


def lead(project, person, status="active"):
    return ProjectMembership.objects.create(user=person, project=project, status=status, role="Lead", roles=["Lead", "Artist"])


def add(client, project, person, **body):
    return client.post(members_url(project), {"user_id": str(person.pk), **body}, format="json")


def sees_project(person, project):
    return client_for(person).get(f"{API}/projects/{project.pk}/").status_code


def fresh(membership):
    return ProjectMembership.all_objects.get(pk=membership.pk)


class TestAddingAgainNamesOnlyWhatChanges:
    @pytest.mark.parametrize("status", STATUSES)
    def test_a_non_active_member_stays_as_they_are_and_cannot_reach_the_project(self, admin, project, person, status):
        member = lead(project, person, status)
        assert sees_project(person, project) == 404

        response = add(admin, project, person)

        assert response.status_code == 200
        assert response.json()["status"] == status
        row = fresh(member)
        assert (row.status, row.role, row.roles) == (status, "Lead", ["Lead", "Artist"])
        assert sees_project(person, project) == 404

    def test_a_lead_is_not_demoted_and_keeps_both_roles(self, admin, project, person):
        member = lead(project, person)

        response = add(admin, project, person)

        assert response.status_code == 200
        assert (response.json()["role"], response.json()["roles"]) == ("Lead", ["Lead", "Artist"])
        assert (fresh(member).role, fresh(member).roles) == ("Lead", ["Lead", "Artist"])

    def test_a_role_that_is_sent_replaces_the_role_and_the_roles_as_before(self, admin, project, person):
        member = lead(project, person)

        response = add(admin, project, person, role="Artist")

        assert response.status_code == 200
        assert (fresh(member).role, fresh(member).roles, fresh(member).status) == ("Artist", ["Artist"], "active")

    def test_roles_that_are_sent_replace_the_roles(self, admin, project, person):
        member = lead(project, person)

        add(admin, project, person, roles=["Lead", "Supervisor"])

        assert fresh(member).roles == ["Lead", "Supervisor"]
        assert fresh(member).role == "Lead"

    @pytest.mark.parametrize("status", STATUSES)
    def test_a_status_that_is_sent_is_set(self, admin, project, person, status):
        member = lead(project, person)

        response = add(admin, project, person, status=status)

        assert response.status_code == 200
        assert fresh(member).status == status

    def test_an_explicit_active_reinstates_a_suspended_member(self, admin, project, person):
        member = lead(project, person, "suspended")

        add(admin, project, person, status="active")

        assert fresh(member).status == "active"
        assert sees_project(person, project) == 200

    def test_the_binding_to_a_show_follows_its_own_rule_and_status_is_untouched(self, admin, project, person):
        show = ShowFactory.create(project=project)
        member = lead(project, person, "suspended")

        response = add(admin, project, person, show=str(show.pk))

        assert response.status_code == 200
        row = fresh(member)
        assert (row.show_id, row.status, row.role) == (show.pk, "suspended", "Lead")

    def test_a_scope_that_was_set_is_kept_and_one_that_is_sent_is_applied(self, admin, project, person):
        member = lead(project, person)
        ProjectMembership.objects.filter(pk=member.pk).update(scope="EXTERNAL")

        add(admin, project, person)
        assert fresh(member).scope == "EXTERNAL"

        add(admin, project, person, scope="PROJECT")
        assert fresh(member).scope == "PROJECT"

    def test_a_department_set_on_the_member_is_kept(self, admin, project, person):
        member = lead(project, person)
        ProjectMembership.objects.filter(pk=member.pk).update(department="Comp")

        add(admin, project, person)

        assert fresh(member).department == "Comp"


class TestANewMemberStillGetsTheDefaults:
    def test_a_person_named_only_by_id_becomes_an_active_artist_on_the_whole_project(self, admin, project, person):
        response = add(admin, project, person)

        assert response.status_code == 201
        body = response.json()
        assert (body["status"], body["role"], body["roles"], body["scope"]) == ("active", "Artist", ["Artist"], "PROJECT")

    def test_a_role_sent_for_a_new_member_is_their_role_and_only_role(self, admin, project, person):
        response = add(admin, project, person, role="Lead")

        assert response.status_code == 201
        assert (response.json()["role"], response.json()["roles"]) == ("Lead", ["Lead"])

    def test_a_status_sent_for_a_new_member_is_kept(self, admin, project, person):
        assert add(admin, project, person, status="suspended").json()["status"] == "suspended"
        assert sees_project(person, project) == 404

    def test_a_blank_role_or_status_counts_as_not_named(self, admin, project, person):
        member = lead(project, person, "suspended")

        add(admin, project, person, role="", status="")

        assert (fresh(member).role, fresh(member).status) == ("Lead", "suspended")


class TestARestoredMembershipStillStartsFresh:
    def test_a_removed_member_added_again_is_a_new_active_artist(self, admin, project, person):
        member = lead(project, person, "suspended")
        member.delete()

        response = add(admin, project, person)

        assert response.status_code == 200
        row = fresh(member)
        assert (row.is_deleted, row.status, row.role, row.roles) == (False, "active", "Artist", ["Artist"])
        assert sees_project(person, project) == 200
