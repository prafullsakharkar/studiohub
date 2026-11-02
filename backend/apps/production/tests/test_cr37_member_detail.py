"""CR-37: a member already on the project is changed or removed by id (PATCH / DELETE members/{id}/)."""

from __future__ import annotations

from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from apps.identity.models import Role
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_all_known_codes
from apps.production.models import ProjectMembership, Task
from apps.production.tests.factories import ProjectFactory, ShotFactory, ShowFactory

pytestmark = pytest.mark.django_db

API = "/api/v1"


def members_url(project):
    return f"/api/organizations/projects/{project.pk}/members/"


def detail_url(project, membership):
    return f"{members_url(project)}{membership.pk}/"


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def project():
    return ProjectFactory.create(code="CR37")


@pytest.fixture
def admin(admin_user):
    return client_for(admin_user)


@pytest.fixture
def person():
    user = UserFactory.create()
    grant_all_known_codes(user)
    return user


@pytest.fixture
def member(project, person):
    return ProjectMembership.objects.create(
        user=person, project=project, status="active", role="Artist", roles=["Artist", "Lead"]
    )


def patch(client, project, membership, **body):
    return client.patch(detail_url(project, membership), body, format="json")


def sees_project(person, project):
    return client_for(person).get(f"{API}/projects/{project.pk}/").status_code


def fresh(membership):
    return ProjectMembership.all_objects.get(pk=membership.pk)


class TestChangingAMember:
    def test_a_role_alone_is_also_the_role_list_so_the_change_shows(self, admin, project, member):
        response = patch(admin, project, member, role="Supervisor")
        assert response.status_code == 200, response.content
        body = response.json()
        assert body["role"] == "Supervisor"
        assert body["roles"] == ["Supervisor"]
        assert fresh(member).roles == ["Supervisor"]

    def test_a_role_list_is_kept_as_sent(self, admin, project, member):
        body = patch(admin, project, member, role="Lead", roles=["Lead", "Artist"]).json()
        assert body["roles"] == ["Lead", "Artist"]

    def test_only_what_is_sent_changes(self, admin, project, member):
        patch(admin, project, member, role="Lead")
        row = fresh(member)
        assert row.status == "active"
        assert row.show_id is None
        assert row.department == ""

    def test_a_canonical_role_is_linked_and_an_unknown_one_refused(self, admin, project, member):
        role = Role.objects.filter(is_deleted=False).first()
        if role is None:
            role = Role.objects.create(code="cr37-role", name="CR37 role")
        ok = patch(admin, project, member, role_id=str(role.pk))
        assert ok.status_code == 200, ok.content
        assert fresh(member).role_ref_id == role.pk
        bad = patch(admin, project, member, role_id=str(uuid4()))
        assert bad.status_code == 400
        assert bad.json()["role_id"] == ["Unknown role."]

    def test_an_empty_body_and_unknown_fields_only_are_refused(self, admin, project, member):
        for body in ({}, {"nonsense": 1}):
            response = patch(admin, project, member, **body)
            assert response.status_code == 400
            assert response.json()["non_field_errors"] == ["Nothing to update."]

    def test_the_user_the_project_and_the_external_ids_cannot_be_edited(self, admin, project, member):
        other = ProjectFactory.create(code="ELSEWHERE")
        patch(admin, project, member, status="on_leave", user_id=str(UserFactory.create().pk), project_id=str(other.pk), vendor_id="v1", client_id="c1")
        row = fresh(member)
        assert row.project_id == project.pk
        assert row.user_id == member.user_id
        assert (row.vendor_id, row.client_id) == ("", "")
        assert row.status == "on_leave"


class TestStatusIsAccess:
    def test_a_member_loses_the_project_when_taken_off_active_and_gets_it_back(self, admin, project, member, person):
        assert sees_project(person, project) == 200
        for status in ("suspended", "On_Leave", "TERMINATED"):
            assert patch(admin, project, member, status=status).status_code == 200
            assert sees_project(person, project) == 404, status
        back = patch(admin, project, member, status="Active")
        assert back.json()["status"] == "active"
        assert sees_project(person, project) == 200

    def test_an_unknown_status_is_refused_and_changes_nothing(self, admin, project, member):
        assert patch(admin, project, member, status="retired").status_code == 400
        assert fresh(member).status == "active"


class TestShow:
    def test_a_member_is_bound_and_released(self, admin, project, member):
        show = ShowFactory.create(project=project, code="S1")
        bound = patch(admin, project, member, show=str(show.pk)).json()
        assert (bound["show_id"], bound["show_code"], bound["scope"]) == (str(show.pk), "S1", "SHOW")
        released = patch(admin, project, member, show=None).json()
        assert (released["show_id"], released["scope"]) == (None, "PROJECT")

    def test_another_projects_show_and_a_deleted_one_are_refused(self, admin, project, member):
        foreign = ShowFactory.create(project=ProjectFactory.create(code="OTHER"))
        gone = ShowFactory.create(project=project, code="GONE")
        gone.is_deleted = True
        gone.save()
        for show in (foreign, gone):
            response = patch(admin, project, member, show=str(show.pk))
            assert response.status_code == 400
            assert response.json()["show"] == ["Unknown show."]
        assert fresh(member).show_id is None


class TestDepartment:
    def test_a_department_is_set_cleared_and_returned(self, admin, project, member):
        body = patch(admin, project, member, department="Comp", department_id="d-comp").json()
        assert (body["department"], body["department_id"]) == ("Comp", "d-comp")
        cleared = patch(admin, project, member, department="", department_id="").json()
        assert (cleared["department"], cleared["department_id"]) == ("", "")

    def test_a_department_set_through_the_api_narrows_what_the_member_lists(self, admin, project, member, person):
        shot = ShotFactory.create(project=project)
        mk = lambda code, department: Task.objects.create(  # noqa: E731
            project=project, shot=shot, title=code, code=code, department=department, status="Not Started", priority="Medium"
        )
        comp, anim = mk("T-COMP", "Comp"), mk("T-ANIM", "Anim")

        def listed():
            body = client_for(person).get(f"{API}/tasks/").json()
            return {str(t["id"]) for t in (body["results"] if isinstance(body, dict) else body)}

        assert listed() == {str(comp.pk), str(anim.pk)}
        patch(admin, project, member, department="comp")  # matched case-insensitively
        assert listed() == {str(comp.pk)}
        patch(admin, project, member, department="")
        assert listed() == {str(comp.pk), str(anim.pk)}


class TestRemoving:
    def test_a_member_is_removed_loses_the_project_and_is_not_listed(self, admin, project, member, person):
        assert sees_project(person, project) == 200
        assert admin.delete(detail_url(project, member)).status_code == 204
        assert sees_project(person, project) == 404
        assert ProjectMembership.all_objects.get(pk=member.pk).is_deleted is True
        ids = {r["id"] for r in admin.get(members_url(project)).json()["results"]}
        assert str(member.pk) not in ids

    def test_adding_them_again_restores_the_same_row(self, admin, project, member, person):
        admin.delete(detail_url(project, member))
        again = admin.post(members_url(project), {"user_id": str(person.pk), "role": "Artist"}, format="json")
        assert again.status_code == 200
        assert again.json()["id"] == str(member.pk)
        assert sees_project(person, project) == 200

    def test_a_restored_member_starts_fresh_without_the_department_they_had(self, admin, project, member, person):
        patch(admin, project, member, department="Comp", department_id="d-comp")
        admin.delete(detail_url(project, member))
        admin.post(members_url(project), {"user_id": str(person.pk), "role": "Artist"}, format="json")
        row = fresh(member)
        assert (row.department, row.department_id, row.show_id) == ("", "", None)

    def test_what_they_were_assigned_is_left_alone(self, admin, project, member, person):
        shot = ShotFactory.create(project=project, assigned_artist=person)
        admin.delete(detail_url(project, member))
        shot.refresh_from_db()
        assert shot.assigned_artist_id == person.pk

    def test_a_removed_member_cannot_be_changed_or_removed_again(self, admin, project, member):
        admin.delete(detail_url(project, member))
        assert patch(admin, project, member, role="Lead").status_code == 404
        assert admin.delete(detail_url(project, member)).status_code == 404


class TestWhoAndWhere:
    def test_an_unknown_member_and_another_projects_member_are_404(self, admin, project, member):
        other = ProjectFactory.create(code="OTHER2")
        assert admin.patch(f"{members_url(project)}{uuid4()}/", {"role": "Lead"}, format="json").status_code == 404
        assert admin.patch(f"{members_url(other)}{member.pk}/", {"role": "Lead"}, format="json").status_code == 404
        assert admin.delete(f"{members_url(other)}{member.pk}/").status_code == 404
        assert fresh(member).is_deleted is False

    def test_only_patch_and_delete_exist(self, admin, project, member):
        # An unmapped method is refused by the permission layer (403, as on every method-mapped view: CR-06), never served.
        assert admin.get(detail_url(project, member)).status_code == 403
        assert admin.put(detail_url(project, member), {"role": "Lead"}, format="json").status_code == 403
        assert fresh(member).role == "Artist"

    def test_someone_who_may_not_manage_members_is_refused_and_nothing_changes(self, project, member):
        plain = UserFactory.create()
        grant_all_known_codes(plain)
        ProjectMembership.objects.create(user=plain, project=project, status="active", role="Artist")
        client = client_for(plain)
        assert patch(client, project, member, role="Lead").status_code == 403
        assert client.delete(detail_url(project, member)).status_code == 403
        assert fresh(member).role == "Artist"
        assert fresh(member).is_deleted is False

    def test_a_member_narrowed_to_a_show_or_department_does_not_reach_the_route(self, project, member):
        show = ShowFactory.create(project=project, code="S1")
        creator = UserFactory.create()
        grant_all_known_codes(creator)
        project.created_by = creator
        project.save()
        ProjectMembership.objects.create(user=creator, project=project, status="active", role="Lead", show=show)
        assert patch(client_for(creator), project, member, role="Lead").status_code == 404
        assert client_for(creator).delete(detail_url(project, member)).status_code == 404


class TestNobodyTakesTheirOwnMembershipOff:
    @pytest.fixture
    def creator(self, project):
        user = UserFactory.create()
        grant_all_known_codes(user)
        project.created_by = user
        project.save()
        own = ProjectMembership.objects.create(user=user, project=project, status="active", role="Lead")
        return user, own

    def test_the_creator_cannot_remove_or_deactivate_themselves(self, project, creator):
        user, own = creator
        client = client_for(user)
        assert client.delete(detail_url(project, own)).status_code == 400
        for status in ("suspended", "on_leave", "terminated"):
            response = patch(client, project, own, status=status)
            assert response.status_code == 400, status
            assert response.json()["detail"] == "You cannot take your own membership off the project."
        assert fresh(own).status == "active"
        assert fresh(own).is_deleted is False

    def test_they_can_still_change_everything_else_about_themselves(self, project, creator):
        user, own = creator
        client = client_for(user)
        assert patch(client, project, own, role="Producer").status_code == 200
        assert patch(client, project, own, status="active").status_code == 200

    def test_a_platform_administrator_is_held_to_it_for_themselves_but_not_for_others(self, project, member, admin_user, admin):
        own = ProjectMembership.objects.create(user=admin_user, project=project, status="active", role="Lead")
        assert admin.delete(detail_url(project, own)).status_code == 400
        assert patch(admin, project, own, status="suspended").status_code == 400
        assert admin.delete(detail_url(project, member)).status_code == 204

    def test_the_creator_can_remove_someone_else(self, project, creator, member):
        user, _own = creator
        assert client_for(user).delete(detail_url(project, member)).status_code == 204
