# Django adds reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
Project milestones (DOM-SCH-06, API-SCH-10): narrowed to the caller's projects, a name unique within
the project in any case, Completed reached and left only through its own actions, and a delivery
milestone checked against the project's deliveries through the provider (never imported).
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from django.db import IntegrityError, transaction

from apps.core import providers
from apps.production.tests.factories import ProjectFactory
from apps.scheduling.models import Milestone
from apps.scheduling.services.milestone import DELIVERY_FIGURES
from apps.scheduling.tests.helpers import (
    ALL_CODES,
    CREATE,
    VIEW,
    admin_client,
    client_for,
    person,
)

pytestmark = pytest.mark.django_db

URL = "/api/v1/scheduling/milestones/"
UNKNOWN = "00000000-0000-0000-0000-000000000000"


@pytest.fixture
def project():
    return ProjectFactory.create(code="MSA")


@pytest.fixture
def user(project):
    return person(*ALL_CODES, project=project)


@pytest.fixture
def api(user):
    return client_for(user)


def _make(project, name="Rough cut", **fields):
    return Milestone.objects.create(
        project=project, name=name, due_date=fields.pop("due_date", date(2026, 12, 1)), **fields
    )


def _body(project, **extra):
    return {"project_id": str(project.pk), "name": "Rough cut", "due_date": "2026-12-01", **extra}


class TestCreating:
    def test_a_member_creates_a_milestone_of_their_project(self, api, project):
        response = api.post(URL, _body(project, order=2, notes="n"), format="json")

        assert response.status_code == 201, response.content
        body = response.json()
        assert (
            body["name"] == "Rough cut"
            and body["status"] == "Pending"
            and body["kind"] == "general"
        )
        assert body["project"] == str(project.pk) and body["project_code"] == "MSA"
        assert body["order"] == 2 and body["completed_at"] is None

    def test_the_project_may_be_named_by_code(self, api, project):
        assert api.post(URL, _body(project, project_id="MSA"), format="json").status_code == 201

    def test_another_projects_milestone_cannot_be_created_and_looks_like_an_unknown_project(
        self, api
    ):
        foreign = ProjectFactory.create(code="MSB")

        in_foreign = api.post(URL, _body(foreign), format="json")
        unknown = api.post(URL, _body(foreign, project_id=UNKNOWN), format="json")

        for response in (in_foreign, unknown):
            assert response.status_code == 400 and "Unknown project" in response.content.decode()
        assert Milestone.objects.count() == 0

    def test_a_platform_admin_may_use_any_project(self):
        foreign = ProjectFactory.create(code="MSC")

        assert admin_client().post(URL, _body(foreign), format="json").status_code == 201

    @pytest.mark.parametrize("missing", ["project_id", "name", "due_date"])
    def test_the_project_name_and_date_are_required(self, api, project, missing):
        body = _body(project)
        del body[missing]

        assert api.post(URL, body, format="json").status_code == 400

    def test_a_name_is_unique_in_a_project_in_any_case(self, api, project):
        assert api.post(URL, _body(project), format="json").status_code == 201

        for name in ("Rough cut", "rough cut", "ROUGH CUT", " Rough cut "):
            response = api.post(URL, _body(project, name=name), format="json")
            assert response.status_code == 400, name
            assert "already has a milestone" in response.content.decode()
        assert Milestone.objects.count() == 1

    def test_the_same_name_in_another_project_is_fine(self, api, project, user):
        other = ProjectFactory.create(code="MSD")
        from apps.production.models import ProjectMembership

        ProjectMembership.objects.create(user=user, project=other, status="active", role="Artist")
        assert api.post(URL, _body(project), format="json").status_code == 201

        assert api.post(URL, _body(other), format="json").status_code == 201

    def test_a_deleted_milestone_frees_its_name(self, api, project):
        first = api.post(URL, _body(project), format="json").json()
        assert api.delete(f"{URL}{first['id']}/").status_code == 204

        assert api.post(URL, _body(project), format="json").status_code == 201

    def test_the_database_holds_the_name_rule(self, project):
        _make(project, "Dup")

        with pytest.raises(IntegrityError), transaction.atomic():
            _make(project, "DUP")


class TestScoping:
    def test_a_member_lists_their_projects_milestones_only(self, api, project):
        mine = _make(project, "Mine")
        _make(ProjectFactory.create(code="MSE"), "Theirs")

        listed = api.get(URL).json()

        assert [m["id"] for m in listed] == [str(mine.pk)]

    def test_another_projects_id_is_404_like_an_unknown_one(self, api):
        theirs = _make(ProjectFactory.create(code="MSF"), "Theirs")

        foreign = api.get(f"{URL}{theirs.pk}/")
        unknown = api.get(f"{URL}{UNKNOWN}/")

        def shape(response):
            body = response.json()
            body.get("error", {}).pop("request_id", None)
            return response.status_code, body

        assert foreign.status_code == 404 and shape(foreign) == shape(unknown)

    @pytest.mark.parametrize(
        ("method", "suffix", "body"),
        [
            ("patch", "", {"name": "x"}),
            ("put", "", {"name": "x"}),
            ("delete", "", None),
            ("post", "complete/", {}),
            ("post", "reopen/", {}),
        ],
    )
    def test_every_write_on_a_foreign_milestone_is_404_and_changes_nothing(
        self, api, method, suffix, body
    ):
        theirs = _make(ProjectFactory.create(code="MSG"), "Theirs")
        before = Milestone.all_objects.filter(pk=theirs.pk).values().get()

        response = getattr(api, method)(f"{URL}{theirs.pk}/{suffix}", body, format="json")

        assert response.status_code == 404
        assert Milestone.all_objects.filter(pk=theirs.pk).values().get() == before

    def test_a_platform_admin_sees_every_project(self, project):
        _make(project, "A")
        _make(ProjectFactory.create(code="MSH"), "B")

        assert len(admin_client().get(URL).json()) == 2

    def test_the_list_can_be_narrowed_to_one_project(self, api, project, user):
        from apps.production.models import ProjectMembership

        other = ProjectFactory.create(code="MSI")
        ProjectMembership.objects.create(user=user, project=other, status="active", role="Artist")
        _make(project, "A")
        _make(other, "B")

        assert [m["name"] for m in api.get(URL, {"project_id": str(other.pk)}).json()] == ["B"]
        assert api.get(URL, {"project_id": "nonsense"}).json() == []

    def test_leaving_the_project_takes_effect_on_the_next_request(self, api, project, user):
        from apps.production.models import ProjectMembership

        milestone = _make(project)
        assert api.get(f"{URL}{milestone.pk}/").status_code == 200

        ProjectMembership.objects.filter(user=user, project=project).update(status="inactive")

        assert api.get(f"{URL}{milestone.pk}/").status_code == 404


class TestStatus:
    def test_pending_and_in_progress_move_freely_by_editing(self, api, project):
        milestone = _make(project)

        started = api.patch(f"{URL}{milestone.pk}/", {"status": "In Progress"}, format="json")
        back = api.patch(f"{URL}{milestone.pk}/", {"status": "Pending"}, format="json")

        assert started.json()["status"] == "In Progress" and back.json()["status"] == "Pending"

    def test_completed_cannot_be_set_by_editing(self, api, project):
        milestone = _make(project)

        response = api.patch(f"{URL}{milestone.pk}/", {"status": "Completed"}, format="json")

        assert response.status_code == 400 and "complete action" in response.content.decode()
        milestone.refresh_from_db()
        assert milestone.status == "Pending" and milestone.completed_at is None

    def test_complete_records_who_and_when(self, api, project, user):
        milestone = _make(project)

        response = api.post(f"{URL}{milestone.pk}/complete/")

        assert response.status_code == 200, response.content
        body = response.json()
        assert body["status"] == "Completed" and body["completed_at"]
        assert body["completed_by"] == str(user.pk)

    def test_completing_twice_is_a_400(self, api, project):
        milestone = _make(project)
        api.post(f"{URL}{milestone.pk}/complete/")

        assert api.post(f"{URL}{milestone.pk}/complete/").status_code == 400

    def test_a_completed_milestone_cannot_leave_by_editing_the_status(self, api, project):
        milestone = _make(project)
        api.post(f"{URL}{milestone.pk}/complete/")

        response = api.patch(f"{URL}{milestone.pk}/", {"status": "Pending"}, format="json")

        assert response.status_code == 400 and "reopen action" in response.content.decode()

    def test_reopen_goes_to_in_progress_and_clears_who_and_when(self, api, project):
        milestone = _make(project)
        api.post(f"{URL}{milestone.pk}/complete/")

        response = api.post(f"{URL}{milestone.pk}/reopen/")

        body = response.json()
        assert response.status_code == 200 and body["status"] == "In Progress"
        assert body["completed_at"] is None and body["completed_by"] is None

    def test_only_a_completed_milestone_can_be_reopened(self, api, project):
        assert api.post(f"{URL}{_make(project).pk}/reopen/").status_code == 400

    def test_other_details_of_a_completed_milestone_can_still_be_edited(self, api, project):
        milestone = _make(project)
        api.post(f"{URL}{milestone.pk}/complete/")

        response = api.patch(f"{URL}{milestone.pk}/", {"notes": "signed off"}, format="json")

        assert response.status_code == 200 and response.json()["status"] == "Completed"

    def test_the_database_holds_that_completed_has_a_time(self, project):
        with pytest.raises(IntegrityError), transaction.atomic():
            _make(project, "NoTime", status="Completed")


class TestEditing:
    def test_the_project_cannot_change_but_an_echo_is_fine(self, api, project):
        milestone = _make(project)
        other = ProjectFactory.create(code="MSJ")

        moved = api.patch(f"{URL}{milestone.pk}/", {"project_id": str(other.pk)}, format="json")
        echo = api.patch(f"{URL}{milestone.pk}/", {"project_id": str(project.pk)}, format="json")
        by_code = api.patch(f"{URL}{milestone.pk}/", {"project_id": "MSA"}, format="json")

        assert moved.status_code == 400 and "Cannot be changed" in moved.content.decode()
        assert echo.status_code == 200 and by_code.status_code == 200

    def test_renaming_onto_another_milestone_is_a_400_but_keeping_your_name_is_fine(
        self, api, project
    ):
        mine = _make(project, "Mine")
        _make(project, "Taken")

        clash = api.patch(f"{URL}{mine.pk}/", {"name": "taken"}, format="json")
        same = api.patch(f"{URL}{mine.pk}/", {"name": "MINE", "order": 3}, format="json")

        assert clash.status_code == 400 and same.status_code == 200

    def test_a_full_put_of_what_was_read_is_accepted(self, api, project):
        milestone = _make(project)
        read = api.get(f"{URL}{milestone.pk}/").json()

        assert api.put(f"{URL}{milestone.pk}/", read, format="json").status_code == 200


class _Figures:
    """A stand-in for the deliveries provider: it knows one delivery per project."""

    def __init__(self, known):
        self.known = known

    def entity_ids(self, project):
        return self.known.get(project.pk, [])


@pytest.fixture
def figures():
    """Register a stand-in provider, then put back whatever the real app registered."""
    original = providers.get(DELIVERY_FIGURES)
    stand_in = _Figures({})
    providers.register(DELIVERY_FIGURES, stand_in)
    yield stand_in
    if original is None:
        providers.unregister(DELIVERY_FIGURES)
    else:
        providers.register(DELIVERY_FIGURES, original)


class TestDeliveryMilestones:
    def test_it_names_a_delivery_of_the_project(self, api, project, figures):
        delivery_id = uuid.uuid4()
        figures.known[project.pk] = [delivery_id]

        response = api.post(
            URL,
            _body(project, kind="delivery", delivery_package_id=str(delivery_id)),
            format="json",
        )

        assert response.status_code == 201, response.content
        assert response.json()["delivery_package_id"] == str(delivery_id)

    def test_an_unknown_delivery_or_one_of_another_project_is_a_400(self, api, project, figures):
        other_projects_delivery = uuid.uuid4()
        figures.known[ProjectFactory.create(code="MSK").pk] = [other_projects_delivery]

        for delivery_id in (uuid.uuid4(), other_projects_delivery):
            response = api.post(
                URL,
                _body(project, kind="delivery", delivery_package_id=str(delivery_id)),
                format="json",
            )
            assert response.status_code == 400 and "Unknown delivery" in response.content.decode()

    def test_a_delivery_milestone_needs_a_delivery(self, api, project, figures):
        response = api.post(URL, _body(project, kind="delivery"), format="json")

        assert response.status_code == 400 and "needs a delivery" in response.content.decode()

    def test_a_general_milestone_names_no_delivery(self, api, project, figures):
        response = api.post(
            URL, _body(project, delivery_package_id=str(uuid.uuid4())), format="json"
        )

        assert response.status_code == 400
        assert "Only a delivery milestone" in response.content.decode()

    def test_without_the_provider_a_delivery_cannot_be_checked_so_it_is_refused(self, api, project):
        original = providers.get(DELIVERY_FIGURES)
        providers.unregister(DELIVERY_FIGURES)
        try:
            response = api.post(
                URL,
                _body(project, kind="delivery", delivery_package_id=str(uuid.uuid4())),
                format="json",
            )
        finally:
            if original is not None:
                providers.register(DELIVERY_FIGURES, original)

        assert response.status_code == 400 and "not available" in response.content.decode()

    def test_the_database_holds_that_a_delivery_milestone_names_a_delivery(self, project):
        with pytest.raises(IntegrityError), transaction.atomic():
            _make(project, "NoDelivery", kind="delivery")


class TestAccess:
    def test_without_the_view_code_it_is_a_403(self, project):
        client = client_for(person(CREATE, project=project))

        assert client.get(URL).status_code == 403

    def test_each_write_needs_its_code(self, project):
        milestone = _make(project)
        viewer = client_for(person(VIEW, project=project))

        assert viewer.get(URL).status_code == 200
        assert viewer.post(URL, _body(project), format="json").status_code == 403
        assert (
            viewer.patch(f"{URL}{milestone.pk}/", {"name": "y"}, format="json").status_code == 403
        )
        assert viewer.post(f"{URL}{milestone.pk}/complete/").status_code == 403
        assert viewer.delete(f"{URL}{milestone.pk}/").status_code == 403

    def test_a_hard_delete_of_the_project_is_blocked_by_the_database(self, project):
        from django.db.models import ProtectedError

        _make(project)

        with pytest.raises(ProtectedError):
            type(project).all_objects.filter(pk=project.pk).delete()
