"""
Two simultaneous approvals of one record (PostgreSQL only).

Real threads with their own connections and committed transactions
(``transaction=True``): exactly one approval wins, the other gets a 409, and the
approval leaves one history row, one ``StatusChanged`` event and one change-log
diff. The loser re-reads the status inside the row lock, which is why it sees the
winner's result. Races are probabilistic, so each case repeats.
"""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor

import pytest
from django.db import connection, connections
from rest_framework.test import APIClient

from apps.audit.models import ChangeLog
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership, StatusHistory
from apps.production.tests.factories import ProjectFactory, ShotFactory, TaskFactory, TimelogFactory

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.skipif(connection.vendor != "postgresql", reason="needs row locks (PostgreSQL)"),
]

ROUNDS = 12


def _approver(project, *codes):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _race(requests):
    """Fire ``requests`` (callables returning a response) at the same moment; return their status codes."""
    barrier = threading.Barrier(len(requests))

    def run(request):
        try:
            barrier.wait(timeout=10)
            return request().status_code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=len(requests)) as pool:
        return sorted(pool.map(run, requests))


def _events(monkeypatch):
    from apps.production.services import status as status_module

    published = []
    original = status_module.default_event_bus.publish

    def record(event):
        published.append(event)
        return original(event)

    monkeypatch.setattr(status_module.default_event_bus, "publish", record)
    return published


def _status_diffs(model_name, pk):
    rows = ChangeLog.objects.filter(target_type=model_name, target_id=str(pk), change_type="update")
    return [row for row in rows if "status" in (row.changed_fields or [])]


def test_two_shot_approvals_give_one_winner_one_conflict_and_one_event(monkeypatch):
    project = ProjectFactory.create(code="RACE1")
    one = _approver(project, "shot.view", "shot.approve")
    two = _approver(project, "shot.view", "shot.approve")
    published = _events(monkeypatch)

    for round_number in range(ROUNDS):
        shot = ShotFactory.create(project=project, code=f"R{round_number}", status="Pending Review")
        published.clear()

        codes = _race(
            [
                lambda shot=shot: one.post(f"/api/v1/shots/{shot.id}/approve/", {}, format="json"),
                lambda shot=shot: two.post(f"/api/v1/shots/{shot.id}/approve/", {}, format="json"),
            ]
        )

        assert codes == [200, 409], f"round {round_number}: {codes}"
        shot.refresh_from_db()
        assert shot.status == "Approved"
        assert StatusHistory.objects.filter(entity_id=shot.id).count() == 1
        assert (
            len([event for event in published if event.payload["entity_id"] == str(shot.id)]) == 1
        )
        assert len(_status_diffs("Shot", shot.id)) == 1


def test_two_timelog_approvals_give_one_winner_one_conflict_and_one_event(monkeypatch):
    project = ProjectFactory.create(code="RACE2")
    task = TaskFactory.create(project=project, code="T1")
    codes_needed = ("timelog.view", "timelog.view_all", "timelog.approve")
    one = _approver(project, *codes_needed)
    two = _approver(project, *codes_needed)
    published = _events(monkeypatch)

    for round_number in range(ROUNDS):
        log = TimelogFactory.create(task=task, person=UserFactory.create())
        published.clear()

        codes = _race(
            [
                lambda log=log: one.post(f"/api/v1/timelogs/{log.id}/approve/", {}, format="json"),
                lambda log=log: two.post(f"/api/v1/timelogs/{log.id}/approve/", {}, format="json"),
            ]
        )

        assert codes == [200, 409], f"round {round_number}: {codes}"
        log.refresh_from_db()
        assert log.status == "Approved" and log.approved_by_id is not None
        assert StatusHistory.objects.filter(entity_id=log.id).count() == 1
        assert len([event for event in published if event.payload["entity_id"] == str(log.id)]) == 1
        assert len(_status_diffs("Timelog", log.id)) == 1


def test_an_approval_racing_a_rejection_has_one_outcome():
    project = ProjectFactory.create(code="RACE3")
    task = TaskFactory.create(project=project, code="T1")
    codes_needed = ("timelog.view", "timelog.view_all", "timelog.approve")
    approver = _approver(project, *codes_needed)
    rejecter = _approver(project, *codes_needed)

    for round_number in range(ROUNDS):
        log = TimelogFactory.create(task=task, person=UserFactory.create())

        codes = _race(
            [
                lambda log=log: approver.post(
                    f"/api/v1/timelogs/{log.id}/approve/", {}, format="json"
                ),
                lambda log=log: rejecter.post(
                    f"/api/v1/timelogs/{log.id}/reject/",
                    {"rejection_reason": "late"},
                    format="json",
                ),
            ]
        )

        # The loser finds the record already decided: a conflict or an invalid move, never a second decision.
        assert codes[0] == 200 and codes[1] in (400, 409), f"round {round_number}: {codes}"
        assert StatusHistory.objects.filter(entity_id=log.id).count() == 1
