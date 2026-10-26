"""
Leave requests are decided once, by someone else, and recorded (DECISIONS D-20).

Status, the decision fields and ``total_days`` are not client-writable; approve and reject
work from Pending only, under a row lock; a leave's reason is shown to its owner and to
approvers only.
"""

from __future__ import annotations

import threading
from datetime import date

import pytest
from django.db import connection
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.scheduling.models import Resource, ResourceLeave
from apps.scheduling.services import approve_leave, count_leave_days, reject_leave

pytestmark = pytest.mark.django_db

LIST = "api:v1:scheduling:resource-leave-list"


def _detail(leave):
    return reverse("api:v1:scheduling:resource-leave-detail", kwargs={"uuid": str(leave.id)})


def _act(leave, name):
    return reverse(f"api:v1:scheduling:resource-leave-{name}", kwargs={"uuid": str(leave.id)})


def _client(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _user(*codes):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    return user


def _person(user=None, code="R1"):
    return Resource.objects.create(name=code, code=code, resource_type="Person", user=user)


def _leave(resource, **extra):
    fields = {
        "leave_type": "Vacation",
        "start_date": date(2026, 9, 1),
        "end_date": date(2026, 9, 3),
        "total_days": 3,
        "reason": "family",
    }
    return ResourceLeave.objects.create(resource=resource, **{**fields, **extra})


@pytest.fixture
def owner():
    return _user("schedule.view", "schedule.create")


@pytest.fixture
def manager():
    return _user("schedule.view", "schedule.create", "schedule.update")


class TestRequestsStartPendingAndCannotBeForged:
    def test_a_new_request_is_pending_with_days_computed(self, owner):
        _person(owner)

        resp = _client(owner).post(
            reverse(LIST),
            {
                "leave_type": "Vacation",
                "start_date": "2026-09-01",
                "end_date": "2026-09-05",
                "reason": "x",
            },
            format="json",
        )

        assert resp.status_code == 201, resp.json()
        assert (resp.json()["status"], resp.json()["total_days"]) == ("Pending", 5)

    @pytest.mark.parametrize(
        ("field", "value"),
        [
            ("status", "Approved"),
            ("approved_by", "00000000-0000-0000-0000-000000000001"),
            ("approved_at", "2026-09-01T00:00:00Z"),
            ("rejected_by", "00000000-0000-0000-0000-000000000001"),
            ("rejection_reason", "forged"),
        ],
    )
    def test_decision_fields_cannot_be_sent_on_create(self, owner, field, value):
        _person(owner)

        resp = _client(owner).post(
            reverse(LIST),
            {
                "leave_type": "Vacation",
                "start_date": "2026-09-01",
                "end_date": "2026-09-02",
                field: value,
            },
            format="json",
        )

        assert resp.status_code == 400
        assert field in resp.json()
        assert not ResourceLeave.objects.exists()

    def test_the_days_cannot_be_forged_but_may_be_echoed(self, owner):
        _person(owner)
        base = {"leave_type": "Vacation", "start_date": "2026-09-01", "end_date": "2026-09-03"}

        forged = _client(owner).post(reverse(LIST), {**base, "total_days": 99}, format="json")
        echoed = _client(owner).post(reverse(LIST), {**base, "total_days": 3}, format="json")

        assert forged.status_code == 400 and "total_days" in forged.json()
        assert echoed.status_code == 201 and echoed.json()["total_days"] == 3

    def test_an_end_before_the_start_is_refused(self, owner):
        _person(owner)

        resp = _client(owner).post(
            reverse(LIST),
            {"leave_type": "Vacation", "start_date": "2026-09-05", "end_date": "2026-09-01"},
            format="json",
        )

        assert resp.status_code == 400 and "end_date" in resp.json()

    def test_status_cannot_be_patched_but_a_pending_request_can_be_edited(self, manager):
        leave = _leave(_person(UserFactory.create()))
        api = _client(manager)

        forged = api.patch(_detail(leave), {"status": "Approved"}, format="json")
        edited = api.patch(
            _detail(leave), {"end_date": "2026-09-10", "status": "Pending"}, format="json"
        )

        assert forged.status_code == 400 and "status" in forged.json()
        assert edited.status_code == 200, edited.json()
        leave.refresh_from_db()
        assert (leave.status, leave.total_days) == ("Pending", 10)

    def test_a_decided_request_cannot_be_edited(self, manager):
        leave = _leave(_person(UserFactory.create()), status="Approved")

        resp = _client(manager).patch(_detail(leave), {"reason": "changed my mind"}, format="json")

        assert resp.status_code == 400
        leave.refresh_from_db()
        assert leave.reason == "family"


class TestDecisions:
    def test_approving_records_who_and_when(self, manager):
        leave = _leave(_person(UserFactory.create()))

        resp = _client(manager).post(_act(leave, "approve"))

        assert resp.status_code == 200, resp.json()
        leave.refresh_from_db()
        assert (leave.status, leave.approved_by_id) == ("Approved", manager.id)
        assert leave.approved_at is not None and leave.approved_at > leave.created_at
        assert leave.rejected_by_id is None

    def test_rejecting_records_who_when_and_why(self, manager):
        leave = _leave(_person(UserFactory.create()))

        resp = _client(manager).post(
            _act(leave, "reject"), {"rejection_reason": " crunch "}, format="json"
        )

        assert resp.status_code == 200, resp.json()
        leave.refresh_from_db()
        assert (leave.status, leave.rejected_by_id, leave.rejection_reason) == (
            "Rejected",
            manager.id,
            "crunch",
        )
        assert leave.rejected_at is not None and leave.approved_by_id is None

    def test_a_rejection_needs_a_reason(self, manager):
        leave = _leave(_person(UserFactory.create()))

        resp = _client(manager).post(
            _act(leave, "reject"), {"rejection_reason": "  "}, format="json"
        )

        assert resp.status_code == 400
        leave.refresh_from_db()
        assert leave.status == "Pending"

    @pytest.mark.parametrize("state", ["Approved", "Rejected", "Cancelled"])
    @pytest.mark.parametrize("action", ["approve", "reject"])
    def test_only_a_pending_request_can_be_decided(self, manager, state, action):
        leave = _leave(_person(UserFactory.create()), status=state)

        resp = _client(manager).post(_act(leave, action), {"rejection_reason": "no"}, format="json")

        assert resp.status_code == 400
        leave.refresh_from_db()
        assert leave.status == state

    @pytest.mark.parametrize("action", ["approve", "reject"])
    def test_nobody_decides_their_own_leave(self, manager, action):
        leave = _leave(_person(manager))

        resp = _client(manager).post(_act(leave, action), {"rejection_reason": "no"}, format="json")

        assert resp.status_code == 403
        leave.refresh_from_db()
        assert leave.status == "Pending"

    def test_the_decision_needs_the_update_code(self, owner):
        leave = _leave(_person(UserFactory.create()))

        assert _client(owner).post(_act(leave, "approve")).status_code == 403

    def test_a_resource_without_a_user_can_be_decided_by_anyone_with_the_code(self, manager):
        leave = _leave(_person(None, code="ROOM"))

        assert _client(manager).post(_act(leave, "approve")).status_code == 200


class TestReasonsArePrivate:
    def _rows(self, user):
        return _client(user).get(reverse(LIST)).json()

    def test_only_the_owner_and_approvers_see_the_reasons(self, owner, manager):
        person = _user("schedule.view")
        leave = _leave(_person(person), reason="surgery")
        ResourceLeave.objects.filter(pk=leave.pk).update(
            status="Rejected", rejection_reason="busy week"
        )
        bystander = _user("schedule.view")

        assert [(r["reason"], r["rejection_reason"]) for r in self._rows(bystander)] == [("", "")]
        assert [(r["reason"], r["rejection_reason"]) for r in self._rows(person)] == [
            ("surgery", "busy week")
        ]
        assert [(r["reason"], r["rejection_reason"]) for r in self._rows(manager)] == [
            ("surgery", "busy week")
        ]
        # the request itself stays visible for planning
        row = self._rows(bystander)[0]
        assert (row["leave_type"], row["start_date"], row["status"]) == (
            "Vacation",
            "2026-09-01",
            "Rejected",
        )

    def test_the_detail_view_hides_them_too(self):
        leave = _leave(_person(UserFactory.create()), reason="surgery")
        bystander = _user("schedule.view")

        assert _client(bystander).get(_detail(leave)).json()["reason"] == ""

    def test_a_superuser_sees_them(self):
        leave = _leave(_person(UserFactory.create()), reason="surgery")
        admin = UserFactory.create(is_superuser=True, is_staff=True)

        assert _client(admin).get(_detail(leave)).json()["reason"] == "surgery"


class TestServiceLevel:
    def test_days_are_inclusive(self):
        assert count_leave_days(date(2026, 9, 1), date(2026, 9, 1)) == 1
        assert count_leave_days(date(2026, 9, 1), date(2026, 9, 30)) == 30

    def test_a_missing_leave_is_a_404_not_a_500(self, manager):
        from rest_framework.exceptions import NotFound

        with pytest.raises(NotFound):
            approve_leave(leave_id="00000000-0000-0000-0000-000000000000", actor=manager)
        with pytest.raises(NotFound):
            reject_leave(
                leave_id="00000000-0000-0000-0000-000000000000", actor=manager, rejection_reason="x"
            )


@pytest.mark.django_db(transaction=True)
def test_two_racing_decisions_cannot_both_win():
    """Approve and reject at once: exactly one takes effect, the loser is refused."""
    first, second = _user("schedule.update"), _user("schedule.update")
    leave = _leave(_person(UserFactory.create()))
    outcomes: list[str] = []
    start = threading.Barrier(2)

    def decide(call):
        try:
            start.wait()
            call()
            outcomes.append("won")
        except Exception as exc:  # noqa: BLE001
            outcomes.append(type(exc).__name__)
        finally:
            connection.close()

    threads = [
        threading.Thread(
            target=decide, args=(lambda: approve_leave(leave_id=str(leave.id), actor=first),)
        ),
        threading.Thread(
            target=decide,
            args=(
                lambda: reject_leave(leave_id=str(leave.id), actor=second, rejection_reason="no"),
            ),
        ),
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    leave.refresh_from_db()
    assert sorted(outcomes) == ["ValidationError", "won"], outcomes
    assert leave.status in ("Approved", "Rejected")
    assert (leave.approved_by_id is None) != (leave.rejected_by_id is None)
