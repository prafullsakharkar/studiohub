"""
Review-pipeline RP-26: the task on the Versions list (docs/review-pipeline/CONTRACTS.md C-RP-61;
Q-RP-117 to Q-RP-120).

WP 26.1: version answers gain ``task_code`` and ``task_title``, ``null`` when the caller could not open
the task (``task.view`` and the task list's own scoping), worked out once per page.
WP 26.2: ``GET versions/?task_id=<id>``, read as ``tasks/?reviewer_id=`` is (never a 400).
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
WITHOUT_TASKS = ("project.view", "version.view")


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPTWOSIX")


@pytest.fixture
def shot(project):
    return ShotFactory.create(project=project, code="RPTWOSIX_SH010")


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


def _task(project, shot, code, **fields):
    return TaskFactory.create(
        project=project,
        shot=shot,
        code=code,
        title=fields.pop("title", f"{code} title"),
        entity_type="Shot",
        entity_id=str(shot.pk),
        entity_code=shot.code,
        **fields,
    )


_index = itertools.count(1)


def _version(project, shot, task=None, **fields):
    fields.setdefault("version_index", next(_index))
    return VersionFactory.create(project=project, shot=shot, task=task, **fields)


def _rows(api, params=None, path="/api/v1/versions/"):
    response = api.get(path, params or {})
    assert response.status_code == 200, response.content
    body = response.json()
    return {row["code"]: row for row in (body["results"] if isinstance(body, dict) else body)}


def _task_of(row):
    return row["task_code"], row["task_title"]


class TestTaskOnARow:
    """WP 26.1 (Q-RP-117, Q-RP-119)."""

    def test_a_reader_of_tasks_sees_the_code_and_title(self, project, shot):
        comp = _task(project, shot, "RPTWOSIX_COMP", title="Comp")
        _version(project, shot, comp, code="WITH_TASK")
        _version(project, shot, None, code="NO_TASK")
        rows = _rows(_api(_user(project)))
        assert _task_of(rows["WITH_TASK"]) == ("RPTWOSIX_COMP", "Comp")
        assert rows["WITH_TASK"]["task_id"] == str(comp.pk)
        assert _task_of(rows["NO_TASK"]) == (None, None)

    def test_the_detail_and_the_project_scoped_list_too(self, project, shot):
        comp = _task(project, shot, "RPTWOSIX_COMP", title="Comp")
        version = _version(project, shot, comp, code="WITH_TASK")
        api = _api(_user(project))
        detail = api.get(f"/api/v1/versions/{version.pk}/").json()
        assert _task_of(detail) == ("RPTWOSIX_COMP", "Comp")
        scoped = _rows(api, path=f"/api/organizations/projects/{project.pk}/versions/")
        assert _task_of(scoped["WITH_TASK"]) == ("RPTWOSIX_COMP", "Comp")

    def test_null_without_task_view(self, project, shot):
        _version(project, shot, _task(project, shot, "RPTWOSIX_COMP"), code="WITH_TASK")
        rows = _rows(_api(_user(project, *WITHOUT_TASKS)))
        assert _task_of(rows["WITH_TASK"]) == (None, None)
        assert rows["WITH_TASK"]["task_id"]  # unchanged: the id was always there

    def test_null_for_a_client_member_in_a_review(self, project, shot):
        client = _user(project, client_id="client-1", role="Client")
        version = _version(project, shot, _task(project, shot, "RPTWOSIX_COMP"), code="IN_REVIEW")
        review = Review.objects.create(project=project, title="Client review")
        ReviewItem.objects.create(review=review, version=version)
        ReviewParticipant.objects.create(review=review, user=client, name="Client")
        rows = _rows(_api(client))
        assert list(rows) == ["IN_REVIEW"]
        assert _task_of(rows["IN_REVIEW"]) == (None, None)
        detail = _api(client).get(f"/api/v1/versions/{version.pk}/").json()
        assert _task_of(detail) == (None, None)

    def test_a_vendor_member_sees_their_vendor_s_task(self, project, shot):
        vendor = _user(project, vendor_id="vendor-1", role="Artist")
        own = _task(project, shot, "RPTWOSIX_VENDOR", vendor_id="vendor-1", title="Vendor comp")
        _version(project, shot, own, code="VENDOR_OWN")
        rows = _rows(_api(vendor))
        assert _task_of(rows["VENDOR_OWN"]) == ("RPTWOSIX_VENDOR", "Vendor comp")

    def test_null_for_an_archived_task(self, project, shot):
        gone = _task(project, shot, "RPTWOSIX_GONE", is_deleted=True)
        _version(project, shot, gone, code="ON_ARCHIVED_TASK")
        rows = _rows(_api(_user(project)))
        assert _task_of(rows["ON_ARCHIVED_TASK"]) == (None, None)

    def test_one_task_query_per_page_whatever_its_size(self, project, shot):
        api = _api(_user(project))

        def task_queries(n):
            for i in range(n):
                _version(
                    project, shot, _task(project, shot, f"RPTWOSIX_T{n}_{i}"), code=f"V{n}_{i}"
                )
            with CaptureQueriesContext(connection) as captured:
                assert len(_rows(api, {"search": f"V{n}_"})) == n
            return sum('FROM "production_task"' in q["sql"] for q in captured.captured_queries)

        assert task_queries(2) == 1
        assert task_queries(6) == 1


class TestTaskFilter:
    """WP 26.2 (Q-RP-118)."""

    def test_one_task_s_versions(self, project, shot):
        comp = _task(project, shot, "RPTWOSIX_COMP")
        light = _task(project, shot, "RPTWOSIX_LIGHT")
        _version(project, shot, comp, code="COMP_1")
        _version(project, shot, comp, code="COMP_2")
        _version(project, shot, light, code="LIGHT_1")
        _version(project, shot, None, code="NO_TASK")
        api = _api(_user(project))
        assert sorted(_rows(api, {"task_id": str(comp.pk)})) == ["COMP_1", "COMP_2"]
        assert sorted(_rows(api, {"task_id": str(light.pk)})) == ["LIGHT_1"]
        assert len(_rows(api)) == 4

    @pytest.mark.parametrize(
        "value", ["00000000-0000-0000-0000-000000000000", "not-a-uuid", "task-1"]
    )
    def test_an_unknown_or_malformed_id_gives_no_rows(self, project, shot, value):
        _version(project, shot, _task(project, shot, "RPTWOSIX_COMP"), code="COMP_1")
        assert _rows(_api(_user(project)), {"task_id": value}) == {}

    def test_combines_with_the_queue_and_the_project(self, project, shot):
        me = _user(project)
        comp = _task(project, shot, "RPTWOSIX_COMP", reviewer=me)
        _version(project, shot, comp, code="WAITING", status="Pending Review")
        _version(project, shot, comp, code="WORKING", status="In Progress")
        other = ProjectFactory.create(code="RPOTHER")
        api = _api(me)
        assert list(_rows(api, {"task_id": str(comp.pk), "to_review": "mine"})) == ["WAITING"]
        assert _rows(api, {"task_id": str(comp.pk), "project_id": str(other.pk)}) == {}

    def test_never_more_than_the_caller_already_reads(self, project, shot):
        client = _user(project, client_id="client-1", role="Client")
        comp = _task(project, shot, "RPTWOSIX_COMP")
        _version(project, shot, comp, code="NOT_IN_A_REVIEW")
        assert _rows(_api(client), {"task_id": str(comp.pk)}) == {}
