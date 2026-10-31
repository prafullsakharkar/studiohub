"""CR-32: a person can be in several teams (CONTRACTS §5.6)."""

from __future__ import annotations

import importlib
import uuid
from typing import Any

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.constants.permissions import MasterdataPermissions as P
from apps.masterdata.models import Person, TeamMembership
from apps.masterdata.tests.factories import (
    DepartmentFactory,
    PersonFactory,
    TeamFactory,
    TeamMembershipFactory,
)

pytestmark = pytest.mark.django_db

API = "/api/v1"
URL = f"{API}/team-memberships/"


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


def rows(response: Any) -> list[dict[str, Any]]:
    return response.json()["results"]


class TestWhoMayDoWhat:
    def test_anonymous_is_refused(self, anon):
        assert anon.get(URL).status_code in (401, 403)

    def test_any_signed_in_user_reads(self, reader):
        TeamMembershipFactory()
        assert reader.get(URL).status_code == 200

    def test_writes_need_the_directory_permission(self, reader, manager):
        team, person = TeamFactory(), PersonFactory()
        body = {"team": str(team.pk), "person": str(person.pk)}
        assert reader.post(URL, body, format="json").status_code == 403
        assert manager.post(URL, body, format="json").status_code == 201
        membership = TeamMembership.objects.get(team=team, person=person)
        assert reader.delete(f"{URL}{membership.pk}/").status_code == 403

    def test_a_membership_is_never_edited(self, manager):
        membership = TeamMembershipFactory()
        other = PersonFactory()
        assert (
            manager.patch(
                f"{URL}{membership.pk}/", {"person": str(other.pk)}, format="json"
            ).status_code
            == 405
        )
        assert manager.put(f"{URL}{membership.pk}/", {}, format="json").status_code == 405


class TestAddingAndRemoving:
    def test_the_response_names_the_team_and_the_person(self, manager):
        department = DepartmentFactory(name="Lighting")
        team, person = (
            TeamFactory(name="Look Dev"),
            PersonFactory(name="Ada", department=department),
        )
        response = manager.post(
            URL, {"team": str(team.pk), "person": str(person.pk)}, format="json"
        )
        assert response.status_code == 201
        body = response.json()
        assert body["team"] == str(team.pk) and body["team_name"] == "Look Dev"
        assert body["person"] == str(person.pk) and body["person_name"] == "Ada"
        assert (
            body["person_department_name"] == "Lighting" and body["person_status"] == person.status
        )

    def test_a_person_can_be_in_teams_of_different_departments(self, manager, reader):
        person = PersonFactory()
        first, second = TeamFactory(), TeamFactory()
        assert first.department_id != second.department_id
        for team in (first, second):
            assert (
                manager.post(
                    URL, {"team": str(team.pk), "person": str(person.pk)}, format="json"
                ).status_code
                == 201
            )
        listed = rows(reader.get(URL, {"person": str(person.pk)}))
        assert {r["team"] for r in listed} == {str(first.pk), str(second.pk)}

    def test_the_same_person_cannot_join_a_team_twice(self, manager):
        team, person = TeamFactory(), PersonFactory()
        body = {"team": str(team.pk), "person": str(person.pk)}
        assert manager.post(URL, body, format="json").status_code == 201
        again = manager.post(URL, body, format="json")
        assert again.status_code == 400 and "already a member" in again.json()["person"][0]
        assert TeamMembership.objects.filter(team=team, person=person).count() == 1

    def test_an_unknown_or_deleted_person_or_team_is_refused(self, manager):
        team, person = TeamFactory(), PersonFactory()
        assert (
            manager.post(
                URL, {"team": str(team.pk), "person": str(uuid.uuid4())}, format="json"
            ).status_code
            == 400
        )
        assert (
            manager.post(
                URL, {"team": str(uuid.uuid4()), "person": str(person.pk)}, format="json"
            ).status_code
            == 400
        )
        gone = PersonFactory(is_deleted=True)
        assert (
            manager.post(
                URL, {"team": str(team.pk), "person": str(gone.pk)}, format="json"
            ).status_code
            == 400
        )

    def test_removing_is_a_soft_delete_and_the_person_can_join_again(self, manager, reader):
        membership = TeamMembershipFactory()
        assert manager.delete(f"{URL}{membership.pk}/").status_code == 204
        assert rows(reader.get(URL, {"team": str(membership.team_id)})) == []
        assert TeamMembership.all_objects.get(pk=membership.pk).is_deleted
        body = {"team": str(membership.team_id), "person": str(membership.person_id)}
        assert manager.post(URL, body, format="json").status_code == 201

    def test_restoring_is_refused_when_the_person_joined_again(self, manager):
        membership = TeamMembershipFactory()
        body = {"team": str(membership.team_id), "person": str(membership.person_id)}
        manager.delete(f"{URL}{membership.pk}/")
        assert manager.post(URL, body, format="json").status_code == 201
        refused = manager.post(f"{URL}{membership.pk}/restore/")
        assert refused.status_code == 409
        assert "already a member" in str(
            refused.json()
        )  # the service's reason, not a database error
        # Without the second row, the restore works.
        TeamMembership.objects.filter(team=membership.team, person=membership.person).delete()
        assert manager.post(f"{URL}{membership.pk}/restore/").status_code == 200

    def test_the_list_is_filtered_by_team_and_costs_a_fixed_number_of_queries(
        self, reader, django_assert_max_num_queries
    ):
        team = TeamFactory()
        for _ in range(6):
            TeamMembershipFactory(team=team)
        TeamMembershipFactory()  # another team
        with django_assert_max_num_queries(8):
            response = reader.get(URL, {"team": str(team.pk)})
        assert response.json()["count"] == 6


class TestThePrimaryTeamStaysInStep:
    def test_creating_a_person_with_a_team_makes_them_a_member(self, manager):
        team = TeamFactory()
        response = manager.post(
            f"{API}/people/", {"name": "Grace", "team": str(team.pk)}, format="json"
        )
        assert response.status_code == 201
        assert (
            TeamMembership.objects.filter(team=team, person_id=response.json()["id"]).count() == 1
        )

    def test_choosing_a_primary_team_adds_a_membership_and_keeps_the_others(self, manager):
        old, new = TeamFactory(), TeamFactory()
        person = PersonFactory(team=old)
        TeamMembershipFactory(team=old, person=person)
        assert (
            manager.patch(
                f"{API}/people/{person.pk}/", {"team": str(new.pk)}, format="json"
            ).status_code
            == 200
        )
        assert set(
            TeamMembership.objects.filter(person=person).values_list("team_id", flat=True)
        ) == {old.pk, new.pk}

    def test_choosing_the_same_primary_team_again_adds_nothing(self, manager):
        team = TeamFactory()
        person = PersonFactory(team=team)
        for _ in range(2):
            response = manager.patch(
                f"{API}/people/{person.pk}/", {"team": str(team.pk)}, format="json"
            )
            assert response.status_code == 200
        assert TeamMembership.objects.filter(team=team, person=person).count() == 1

    def test_clearing_the_primary_team_keeps_the_memberships(self, manager):
        team = TeamFactory()
        person = PersonFactory(team=team)
        TeamMembershipFactory(team=team, person=person)
        assert (
            manager.patch(f"{API}/people/{person.pk}/", {"team": None}, format="json").status_code
            == 200
        )
        assert TeamMembership.objects.filter(person=person).count() == 1


class TestDeletingTeamsAndPeople:
    def test_a_team_with_members_cannot_be_deleted_until_they_are_removed(self, manager):
        membership = TeamMembershipFactory()
        team_url = f"{API}/teams/{membership.team_id}/"
        refused = manager.delete(team_url)
        assert refused.status_code == 409 and refused.json()["error"]["code"] == "has_dependants"
        manager.delete(f"{URL}{membership.pk}/")
        assert manager.delete(team_url).status_code == 204

    def test_deleting_a_person_removes_their_memberships_and_restoring_brings_them_back(
        self, manager
    ):
        person = PersonFactory()
        first, second = TeamMembershipFactory(person=person), TeamMembershipFactory(person=person)
        assert manager.delete(f"{API}/people/{person.pk}/").status_code == 204
        assert TeamMembership.objects.filter(person=person).count() == 0
        assert manager.post(f"{API}/people/{person.pk}/restore/").status_code == 200
        assert set(TeamMembership.objects.filter(person=person).values_list("pk", flat=True)) == {
            first.pk,
            second.pk,
        }

    def test_a_membership_removed_before_the_person_stays_removed_when_they_are_restored(
        self, manager
    ):
        person = PersonFactory()
        kept, removed = TeamMembershipFactory(person=person), TeamMembershipFactory(person=person)
        manager.delete(f"{URL}{removed.pk}/")
        manager.delete(f"{API}/people/{person.pk}/")
        manager.post(f"{API}/people/{person.pk}/restore/")
        assert set(TeamMembership.objects.filter(person=person).values_list("pk", flat=True)) == {
            kept.pk
        }

    def test_a_person_with_memberships_can_be_deleted_for_good(self):
        admin = client_for(P.DIRECTORY_MANAGE, P.HARD_DELETE)
        person = PersonFactory()
        live, removed = TeamMembershipFactory(person=person), TeamMembershipFactory(person=person)
        admin.delete(f"{URL}{removed.pk}/")
        assert admin.delete(f"{API}/people/{person.pk}/").status_code == 204
        assert admin.delete(f"{API}/people/{person.pk}/?hard=true").status_code == 204
        assert not Person.all_objects.filter(pk=person.pk).exists()
        assert not TeamMembership.all_objects.filter(pk__in=[live.pk, removed.pk]).exists()


class TestTheMigrationStep:
    def test_every_live_person_with_a_live_primary_team_becomes_a_member(self):
        migration = importlib.import_module("apps.masterdata.migrations.0002_team_membership")
        from django.apps import apps

        team, dead_team = TeamFactory(), TeamFactory(is_deleted=True)
        member, already = PersonFactory(team=team), PersonFactory(team=team)
        TeamMembershipFactory(team=team, person=already)
        PersonFactory(team=team, is_deleted=True)
        PersonFactory(team=dead_team)
        PersonFactory(team=None)
        migration.membership_for_primary_team(apps, None)
        migration.membership_for_primary_team(apps, None)  # running it twice changes nothing
        assert set(TeamMembership.objects.values_list("person_id", flat=True)) == {
            member.pk,
            already.pk,
        }
        assert TeamMembership.objects.filter(team=team).count() == 2
