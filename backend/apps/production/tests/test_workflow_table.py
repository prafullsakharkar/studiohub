"""
The status maps, table-driven.

The expected tables below are written out by hand from the rules in
``constants/workflow.py``'s docstring, not computed from it, so a change to the
maps has to change a test too. Each table is checked twice: against
``is_allowed`` and against the real service on a stored record.
"""

from __future__ import annotations

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.constants import workflow
from apps.production.exceptions import InvalidTransition, StatusConflict
from apps.production.models import ProjectMembership, StatusHistory
from apps.production.services.status import StatusService
from apps.production.tests.factories import (
    ProjectFactory,
    ReviewFactory,
    ShotFactory,
    TaskFactory,
    TimelogFactory,
    VersionFactory,
)

pytestmark = pytest.mark.django_db

_PRODUCTION = {
    "Not Started": {"In Progress", "Pending Review", "Retake", "Archived"},
    "In Progress": {"Not Started", "Pending Review", "Retake", "Archived"},
    "Pending Review": {"Not Started", "In Progress", "Retake", "Approved", "Archived"},
    "Retake": {"Not Started", "In Progress", "Pending Review", "Archived"},
    "Approved": {"Archived"},
    "Archived": set(),
}
EXPECTED = {
    "shot": {
        "Not Started": {"In Progress", "Pending Review", "Retake", "On Hold", "Archived"},
        "In Progress": {"Not Started", "Pending Review", "Retake", "On Hold", "Archived"},
        "Pending Review": {
            "Not Started",
            "In Progress",
            "Retake",
            "On Hold",
            "Approved",
            "Archived",
        },
        "Retake": {"Not Started", "In Progress", "Pending Review", "On Hold", "Archived"},
        "On Hold": {"Not Started", "In Progress", "Pending Review", "Retake", "Archived"},
        "Approved": {"Archived"},
        "Archived": set(),
    },
    "task": _PRODUCTION,
    "version": _PRODUCTION,
    "review": {
        "Pending Review": {"Submitted", "In Review", "Closed"},
        "Submitted": {"In Review", "Closed"},
        "In Review": {"Approved", "Rejected", "Changes Requested", "Retake", "Closed"},
        "Changes Requested": {"Submitted", "In Review", "Closed"},
        "Retake": {"Submitted", "In Review", "Closed"},
        "Rejected": {"Submitted", "Closed"},
        "Approved": {"Closed"},
        "Closed": set(),
    },
    "timelog": {
        "Draft": {"Submitted"},
        "Submitted": {"Approved", "Rejected", "Draft"},
        "Rejected": {"Submitted", "Draft"},
        "Approved": set(),
    },
}

PAIRS = [
    (entity, source, target)
    for entity, table in EXPECTED.items()
    for source in table
    for target in table
    if source != target
]
IDS = [f"{entity}:{source}->{target}" for entity, source, target in PAIRS]

APPROVE_CODES = ("shot.approve", "version.publish", "review.approve", "timelog.approve")


@pytest.fixture
def project():
    return ProjectFactory.create(code="TBL01")


@pytest.fixture
def approver(project):
    """Holds every code the maps ask for, produced none of the records, no override."""
    user = UserFactory.create()
    grant_permissions(user, *APPROVE_CODES)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def _make(entity, project, status_value):
    if entity == "shot":
        return ShotFactory.create(project=project, code="S", status=status_value)
    if entity == "task":
        return TaskFactory.create(project=project, code="T", status=status_value)
    if entity == "version":
        return VersionFactory.create(project=project, code="V", status=status_value)
    if entity == "review":
        return ReviewFactory.create(project=project, status=status_value)
    return TimelogFactory.create(
        task=TaskFactory.create(project=project, code="TL"), status=status_value
    )


def test_the_tables_cover_every_status_of_every_entity():
    for entity, table in EXPECTED.items():
        assert set(table) == set(workflow.valid_statuses(entity)), entity


@pytest.mark.parametrize(("entity", "source", "target"), PAIRS, ids=IDS)
def test_is_allowed_matches_the_table(entity, source, target):
    assert workflow.is_allowed(entity, source, target) is (target in EXPECTED[entity][source])


@pytest.mark.parametrize(("entity", "source", "target"), PAIRS, ids=IDS)
def test_the_service_follows_the_table(project, approver, entity, source, target):
    record = _make(entity, project, source)

    if target in EXPECTED[entity][source]:
        StatusService.transition_status(actor=approver, entity=record, to_status=target)
        record.refresh_from_db()
        assert record.status == target
        assert StatusHistory.objects.filter(entity_id=record.pk).count() == 1
    else:
        with pytest.raises(InvalidTransition):
            StatusService.transition_status(actor=approver, entity=record, to_status=target)
        record.refresh_from_db()
        assert record.status == source
        assert not StatusHistory.objects.filter(entity_id=record.pk).exists()


@pytest.mark.parametrize("entity", sorted(EXPECTED))
def test_an_unknown_status_is_refused(project, approver, entity):
    record = _make(entity, project, next(iter(EXPECTED[entity])))

    with pytest.raises(InvalidTransition):
        StatusService.transition_status(actor=approver, entity=record, to_status="Nonsense")


class TestOverride:
    CODE = "production.status.override"

    def _actor(self, project, *codes):
        user = UserFactory.create()
        grant_permissions(user, *codes)
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
        return user

    @pytest.mark.parametrize(
        ("entity", "source", "target"),
        [
            ("shot", "Approved", "In Progress"),
            ("shot", "Archived", "Not Started"),
            ("shot", "Not Started", "Approved"),
            ("task", "Approved", "Retake"),
            ("version", "Approved", "Pending Review"),
            ("review", "Closed", "In Review"),
        ],
    )
    def test_corrections_need_the_code_and_a_reason_and_are_recorded(
        self, project, entity, source, target
    ):
        record = _make(entity, project, source)
        everything = (*APPROVE_CODES, self.CODE)
        actor = self._actor(project, *everything)
        no_code = self._actor(project, *APPROVE_CODES)

        with pytest.raises(InvalidTransition):
            StatusService.transition_status(
                actor=no_code, entity=record, to_status=target, override_reason="fix"
            )
        with pytest.raises(InvalidTransition) as no_reason:
            StatusService.transition_status(actor=actor, entity=record, to_status=target)
        assert "override_reason" in no_reason.value.detail

        StatusService.transition_status(
            actor=actor, entity=record, to_status=target, override_reason="wrong shot approved"
        )
        record.refresh_from_db()
        assert record.status == target
        (row,) = StatusHistory.objects.filter(entity_id=record.pk)
        assert (row.override_kind, row.reason, row.actor) == (
            "status",
            "wrong shot approved",
            actor,
        )

    def test_an_approved_timelog_is_never_overridden(self, project):
        log = _make("timelog", project, "Approved")
        actor = self._actor(project, *APPROVE_CODES, self.CODE)

        with pytest.raises(InvalidTransition):
            StatusService.transition_status(
                actor=actor, entity=log, to_status="Submitted", override_reason="oops"
            )

    def test_the_override_does_not_replace_the_approve_code(self, project):
        from apps.production.exceptions import TransitionNotPermitted

        shot = _make("shot", project, "Not Started")
        actor = self._actor(project, self.CODE)

        with pytest.raises(TransitionNotPermitted):
            StatusService.transition_status(
                actor=actor, entity=shot, to_status="Approved", override_reason="skip review"
            )

    def test_the_override_is_available_over_the_api(self, project):
        shot = _make("shot", project, "Approved")
        actor = self._actor(project, "shot.view", "shot.update", "shot.approve", self.CODE)
        client = APIClient()
        client.force_authenticate(user=actor)

        denied = client.patch(f"/api/v1/shots/{shot.id}/", {"status": "In Progress"}, format="json")
        allowed = client.patch(
            f"/api/v1/shots/{shot.id}/",
            {"status": "In Progress", "override_reason": "approved the wrong take"},
            format="json",
        )

        assert denied.status_code == status.HTTP_400_BAD_REQUEST
        assert allowed.status_code == 200, allowed.json()

    def test_bulk_never_overrides(self, project):
        task = _make("task", project, "Approved")
        actor = self._actor(project, "task.view", "task.update", self.CODE)
        client = APIClient()
        client.force_authenticate(user=actor)

        resp = client.post(
            "/api/v1/tasks/bulk-status/",
            {"task_ids": [str(task.id)], "status": "In Progress", "override_reason": "x"},
            format="json",
        )

        assert resp.status_code == 400  # the bulk body has no override field
        resp = client.post(
            "/api/v1/tasks/bulk-status/",
            {"task_ids": [str(task.id)], "status": "In Progress"},
            format="json",
        )
        assert resp.json()["results"][0]["error"] == "invalid_transition"
        task.refresh_from_db()
        assert task.status == "Approved"


class TestFrozenAndRestore:
    def test_a_published_version_is_frozen(self, project, approver):
        version = VersionFactory.create(
            project=project, code="V1", status="In Progress", is_published=True
        )

        with pytest.raises(InvalidTransition):
            StatusService.transition_status(actor=approver, entity=version, to_status="Retake")

    def test_restore_returns_to_the_status_before_archiving(self, project, approver):
        shot = ShotFactory.create(project=project, code="S1", status="On Hold")
        StatusService.transition_status(actor=approver, entity=shot, to_status="Archived")

        StatusService.restore_status(actor=approver, entity=shot)

        shot.refresh_from_db()
        assert shot.status == "On Hold"

    def test_restore_without_history_starts_over(self, project, approver):
        shot = ShotFactory.create(project=project, code="S1", status="Archived")

        StatusService.restore_status(actor=approver, entity=shot)

        shot.refresh_from_db()
        assert shot.status == "Not Started"

    def test_restore_over_the_api(self, project):
        shot = ShotFactory.create(project=project, code="S1", status="Retake")
        actor = UserFactory.create()
        grant_permissions(actor, "shot.view", "shot.update", "shot.delete")
        ProjectMembership.objects.create(
            user=actor, project=project, status="active", role="Artist"
        )
        client = APIClient()
        client.force_authenticate(user=actor)

        assert client.post(f"/api/v1/shots/{shot.id}/archive/").status_code == 200
        assert client.post(f"/api/v1/shots/{shot.id}/restore/").status_code == 200

        shot.refresh_from_db()
        assert shot.status == "Retake"


class TestStrictActions:
    def test_the_second_approval_is_a_conflict_not_a_second_event(self, project, approver):
        shot = ShotFactory.create(project=project, code="S1", status="Pending Review")
        StatusService.transition_status(
            actor=approver, entity=shot, to_status="Approved", strict=True
        )

        stale = type(shot).objects.get(pk=shot.pk)
        stale.status = "Pending Review"  # a handler still holding the old row
        with pytest.raises(StatusConflict):
            StatusService.transition_status(
                actor=approver, entity=stale, to_status="Approved", strict=True
            )
        assert StatusHistory.objects.filter(entity_id=shot.pk).count() == 1
