"""
Review-pipeline RP-24: waiting for my review (docs/review-pipeline/CONTRACTS.md C-RP-58; Q-RP-109 to
Q-RP-112).

WP 24.1: ``GET versions/?to_review=mine``, the live versions in Pending Review on a live task whose
reviewer is the caller, inside the caller's reach; any other value is a 400 on the field.
WP 24.2: ``GET tasks/?reviewer_id=<id>``, read as ``assignee_id`` is.
"""

from __future__ import annotations

import itertools

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership, Review, ReviewItem, ReviewParticipant
from apps.production.tests.factories import (
    ProjectFactory,
    ShotFactory,
    TaskFactory,
    VersionFactory,
)

pytestmark = pytest.mark.django_db

READER = ("project.view", "version.view", "task.view")
PENDING = "Pending Review"


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPTWOFOUR")


@pytest.fixture
def shot(project):
    return ShotFactory.create(project=project, code="RPTWOFOUR_SH010")


def _user(project, *codes, **membership):
    user = UserFactory.create()
    grant_permissions(user, *(codes or READER))
    membership.setdefault("status", "active")
    membership.setdefault("role", "Supervisor")
    ProjectMembership.objects.create(user=user, project=project, **membership)
    return user


def _api(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _task(project, shot, reviewer=None, **fields):
    return TaskFactory.create(
        project=project,
        shot=shot,
        entity_type="Shot",
        entity_id=str(shot.pk),
        entity_code=shot.code,
        reviewer=reviewer,
        **fields,
    )


_index = itertools.count(1)


def _version(project, shot, task=None, *, status=PENDING, **fields):
    """A version; each has its own index, since a task's versions are numbered (unique per task)."""
    fields.setdefault("version_index", next(_index))
    return VersionFactory.create(project=project, shot=shot, task=task, status=status, **fields)


def _codes(api, params):
    response = api.get("/api/v1/versions/", params)
    assert response.status_code == 200, response.content
    return sorted(row["code"] for row in response.json()["results"])


class TestVersionFilter:
    """WP 24.1 (Q-RP-109, Q-RP-110)."""

    def test_only_pending_review_on_a_live_task_i_review(self, project, shot):
        me = _user(project)
        colleague = _user(project)
        mine = _task(project, shot, reviewer=me, code="RPTWOFOUR_T1")
        theirs = _task(project, shot, reviewer=colleague, code="RPTWOFOUR_T2")
        nobodys = _task(project, shot, code="RPTWOFOUR_T3")
        archived = _task(project, shot, reviewer=me, code="RPTWOFOUR_T4", is_deleted=True)
        archived_status = _task(project, shot, reviewer=me, code="RPTWOFOUR_T5", status="Archived")

        _version(project, shot, mine, code="WAITING")
        _version(project, shot, mine, code="IN_PROGRESS", status="In Progress")
        _version(project, shot, mine, code="APPROVED", status="Approved")
        _version(project, shot, mine, code="RETAKE", status="Retake")
        _version(project, shot, mine, code="GONE", is_deleted=True)
        _version(project, shot, theirs, code="THEIRS")
        _version(project, shot, nobodys, code="NOBODYS")
        _version(project, shot, None, code="NO_TASK")
        _version(project, shot, archived, code="ARCHIVED_TASK")
        _version(project, shot, archived_status, code="ARCHIVED_STATUS")

        assert _codes(_api(me), {"to_review": "mine"}) == ["WAITING"]
        assert _codes(_api(colleague), {"to_review": "mine"}) == ["THEIRS"]
        # without the filter the list is as before
        assert len(_codes(_api(me), {})) == 9

    def test_the_artist_is_not_the_reviewer(self, project, shot):
        me = _user(project)
        task = _task(project, shot, reviewer=_user(project), code="RPTWOFOUR_T1", assignee=me)
        _version(project, shot, task, code="I_MADE_IT", artist=me)
        assert _codes(_api(me), {"to_review": "mine"}) == []

    def test_another_value_is_a_400_on_the_field(self, project):
        me = _user(project)
        for value in ("theirs", str(me.pk), "true"):
            response = _api(me).get("/api/v1/versions/", {"to_review": value})
            assert response.status_code == 400
            assert response.json()["to_review"] == [
                f"Select a valid choice. {value} is not one of the available choices."
            ]

    def test_with_the_other_filters_and_search(self, project, shot):
        me = _user(project)
        other_project = ProjectFactory.create(code="RPTWOFOURB")
        ProjectMembership.objects.create(
            user=me, project=other_project, status="active", role="Supervisor"
        )
        other_shot = ShotFactory.create(project=other_project, code="RPTWOFOURB_SH010")
        mine = _task(project, shot, reviewer=me, code="RPTWOFOUR_T1")
        elsewhere = _task(other_project, other_shot, reviewer=me, code="RPTWOFOURB_T1")
        _version(project, shot, mine, code="RPTWOFOUR_A")
        _version(project, shot, mine, code="RPTWOFOUR_B")
        _version(other_project, other_shot, elsewhere, code="RPTWOFOURB_A")

        api = _api(me)
        assert _codes(api, {"to_review": "mine"}) == ["RPTWOFOURB_A", "RPTWOFOUR_A", "RPTWOFOUR_B"]
        assert _codes(api, {"to_review": "mine", "project_id": str(project.pk)}) == [
            "RPTWOFOUR_A",
            "RPTWOFOUR_B",
        ]
        assert _codes(api, {"to_review": "mine", "search": "FOUR_B"}) == ["RPTWOFOUR_B"]
        assert _codes(api, {"to_review": "mine", "status": "Approved"}) == []

    def test_only_rows_an_external_member_already_reads(self, project, shot):
        vendor = _user(project, vendor_id="vendor-1", role="Artist")
        client = _user(project, client_id="client-1", role="Client")
        own = _task(project, shot, reviewer=vendor, code="RPTWOFOUR_T1", vendor_id="vendor-1")
        studio = _task(project, shot, reviewer=vendor, code="RPTWOFOUR_T2")
        for_client = _task(project, shot, reviewer=client, code="RPTWOFOUR_T3")
        _version(project, shot, own, code="VENDOR_OWN")
        _version(project, shot, studio, code="STUDIO_TASK")
        in_review = _version(project, shot, for_client, code="IN_REVIEW")
        _version(project, shot, for_client, code="NOT_IN_REVIEW")
        review = Review.objects.create(project=project, title="Client review")
        ReviewItem.objects.create(review=review, version=in_review)
        ReviewParticipant.objects.create(review=review, user=client, name="Client")

        assert _codes(_api(vendor), {"to_review": "mine"}) == ["VENDOR_OWN"]
        assert _codes(_api(client), {"to_review": "mine"}) == ["IN_REVIEW"]

    def test_no_query_per_row(self, project, shot):
        me = _user(project)
        task = _task(project, shot, reviewer=me, code="RPTWOFOUR_T1")
        _version(project, shot, task, code="FIRST")
        api = _api(me)
        api.get("/api/v1/versions/", {"to_review": "mine"})  # warm the permission cache
        with CaptureQueriesContext(connection) as one:
            assert len(api.get("/api/v1/versions/", {"to_review": "mine"}).json()["results"]) == 1
        for n in range(4):
            _version(project, shot, task, code=f"MORE{n}")
        with CaptureQueriesContext(connection) as five:
            assert len(api.get("/api/v1/versions/", {"to_review": "mine"}).json()["results"]) == 5
        assert len(five.captured_queries) == len(one.captured_queries)


class TestTaskFilter:
    """WP 24.2 (Q-RP-110)."""

    def test_by_reviewer_id(self, project, shot):
        me = _user(project)
        colleague = _user(project)
        _task(project, shot, reviewer=me, code="RPTWOFOUR_T1")
        _task(project, shot, reviewer=colleague, code="RPTWOFOUR_T2")
        _task(project, shot, assignee=me, code="RPTWOFOUR_T3")

        response = _api(me).get("/api/v1/tasks/", {"reviewer_id": str(me.pk)})
        assert response.status_code == 200
        assert [row["code"] for row in response.json()["results"]] == ["RPTWOFOUR_T1"]
        assert response.json()["results"][0]["reviewer_id"] == str(me.pk)

    @pytest.mark.parametrize("value", ["5c3f0f9e-1b7a-4c1e-9a52-8f0c2d4e6b10", "not-an-id"])
    def test_an_unknown_or_malformed_id_gives_no_rows(self, project, shot, value):
        me = _user(project)
        _task(project, shot, reviewer=me, code="RPTWOFOUR_T1")
        response = _api(me).get("/api/v1/tasks/", {"reviewer_id": value})
        assert response.status_code == 200
        assert response.json()["results"] == []
