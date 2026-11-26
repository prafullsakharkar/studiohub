"""CR-57: a project member's ``name`` is their name, not their e-mail; the people list narrows to people with a login."""

from __future__ import annotations

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.identity.models.profile import Profile
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_all_known_codes
from apps.masterdata.models import Person
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db

API = "/api/v1"


def members_url(project):
    return f"/api/organizations/projects/{project.pk}/members/"


@pytest.fixture
def admin(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def project():
    return ProjectFactory.create(code="CR57")


def member(project, *, email, profile=None, person=None, person_deleted=False):
    """A member whose login has the given profile names (none: no profile) and linked person name (none: no person)."""
    user = UserFactory.create(email=email)
    if profile is not None:
        Profile.objects.update_or_create(user=user, defaults=profile)
    if person is not None:
        linked = Person.objects.create(name=person, user=user)
        if person_deleted:
            linked.is_deleted = True
            linked.save(update_fields=["is_deleted"])
    ProjectMembership.objects.create(
        user=user, project=project, status="active", role="Artist", roles=["Artist"]
    )
    return user


def names(admin, project):
    response = admin.get(members_url(project))
    assert response.status_code == 200, response.content
    return {row["email"]: row["name"] for row in response.json()["results"]}


class TestTheMemberName:
    def test_the_profile_display_name_comes_first(self, admin, project):
        member(
            project,
            email="dn@x.io",
            profile={"display_name": "Dee Display", "first_name": "D", "last_name": "N"},
            person="Person Name",
        )
        assert names(admin, project) == {"dn@x.io": "Dee Display"}

    def test_then_the_profile_first_and_last_name(self, admin, project):
        member(
            project,
            email="fl@x.io",
            profile={"display_name": "", "first_name": "Fay", "last_name": "Last"},
            person="Person Name",
        )
        member(
            project,
            email="f@x.io",
            profile={"display_name": "", "first_name": "Solo", "last_name": ""},
        )
        assert names(admin, project) == {"fl@x.io": "Fay Last", "f@x.io": "Solo"}

    def test_then_the_linked_person_for_a_blank_profile_or_none(self, admin, project):
        # The ATOM import and the LDAP link leave the profile blank and name the directory person.
        member(
            project,
            email="blank@x.io",
            profile={"display_name": "", "first_name": "", "last_name": ""},
            person="Priya Person",
        )
        member(project, email="noprofile@x.io", person="Nico Noprofile")
        assert names(admin, project) == {
            "blank@x.io": "Priya Person",
            "noprofile@x.io": "Nico Noprofile",
        }

    def test_the_email_last_and_a_deleted_person_does_not_count(self, admin, project):
        member(project, email="nobody@x.io")
        member(project, email="gone@x.io", person="Gone Person", person_deleted=True)
        assert names(admin, project) == {"nobody@x.io": "nobody@x.io", "gone@x.io": "gone@x.io"}

    def test_the_list_looks_the_people_up_once(self, admin, project):
        member(project, email="a@x.io", person="A Person")
        with CaptureQueriesContext(connection) as one:
            admin.get(members_url(project))
        for n in range(5):
            member(project, email=f"m{n}@x.io", person=f"Member {n}")
        with CaptureQueriesContext(connection) as six:
            body = admin.get(members_url(project)).json()
        assert {row["name"] for row in body["results"]} >= {"A Person", "Member 4"}
        assert len(six.captured_queries) == len(one.captured_queries)

    def test_the_add_and_the_edit_answer_with_the_name_too(self, admin, project):
        user = UserFactory.create(email="added@x.io")
        Person.objects.create(name="Ada Added", user=user)
        added = admin.post(
            members_url(project), {"user_id": str(user.pk), "role": "Artist"}, format="json"
        )
        assert added.status_code == 201, added.content
        assert added.json()["name"] == "Ada Added"
        edited = admin.patch(
            f"{members_url(project)}{added.json()['id']}/", {"role": "Lead"}, format="json"
        )
        assert edited.status_code == 200, edited.content
        assert edited.json()["name"] == "Ada Added"


class TestPeopleWithALogin:
    @pytest.fixture
    def people(self):
        linked = Person.objects.create(name="With Login", user=UserFactory.create())
        unlinked = Person.objects.create(name="Without Login")
        return linked, unlinked

    def listed(self, admin, query=""):
        response = admin.get(f"{API}/people/{query}")
        assert response.status_code == 200, response.content
        return {row["name"] for row in response.json()["results"]}

    def test_has_user_true_lists_only_people_with_a_login(self, admin, people):
        assert self.listed(admin, "?has_user=true") == {"With Login"}

    def test_has_user_false_lists_only_people_without_one(self, admin, people):
        assert self.listed(admin, "?has_user=false") == {"Without Login"}

    def test_without_the_filter_everyone_is_listed(self, admin, people):
        assert self.listed(admin) == {"With Login", "Without Login"}

    def test_the_other_filters_still_work_beside_it(self, admin, people):
        Person.objects.filter(name="With Login").update(status="inactive")
        assert self.listed(admin, "?has_user=true&status=active") == set()
        assert self.listed(admin, "?has_user=true&status=inactive") == {"With Login"}


class TestAMentionedPersonsName:
    def test_a_note_names_a_mentioned_member_from_their_person(
        self, admin, project, django_capture_on_commit_callbacks
    ):
        mentioned = member(project, email="mentioned@x.io", person="Mona Mentioned")
        nobody = member(project, email="plain@x.io")
        for user in (mentioned, nobody):
            grant_all_known_codes(user)  # who may be mentioned is decided by what they can read
        notes = f"/api/organizations/projects/{project.pk}/notes/"
        with django_capture_on_commit_callbacks(execute=True):
            created = admin.post(
                notes,
                {"subject": "Edge", "mention_ids": [str(mentioned.pk), str(nobody.pk)]},
                format="json",
            )
        assert created.status_code == 201, created.content
        assert [m["name"] for m in created.json()["mentions"]] == ["Mona Mentioned", "plain@x.io"]
        listed = admin.get(notes).json()["results"]
        assert [m["name"] for m in listed[0]["mentions"]] == ["Mona Mentioned", "plain@x.io"]
