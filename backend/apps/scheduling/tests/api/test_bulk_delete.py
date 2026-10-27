"""
``POST /schedules/bulk-delete/`` (API-SCH-14, decision Q36): 1 to 100 distinct ids, each its own
transaction (partial success), 200 when all succeed and 207 otherwise, ``results[]`` of ``id``,
``ok`` and ``error`` (``null`` or ``not_found``).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from apps.scheduling.models import ResourceSchedule
from apps.scheduling.tests.helpers import DELETE, MANAGE, VIEW, client_for, make_resource, person

pytestmark = pytest.mark.django_db

URL = "/api/v1/scheduling/schedules/bulk-delete/"


@pytest.fixture
def api():
    return client_for(person(VIEW, DELETE))


@pytest.fixture
def week():
    """Five back-to-back bookings of one resource."""
    resource = make_resource()
    start = datetime(2026, 11, 2, 9, tzinfo=UTC)
    return [
        ResourceSchedule.objects.create(
            resource=resource,
            start_time=start + timedelta(hours=i),
            end_time=start + timedelta(hours=i + 1),
            status="Booked",
        )
        for i in range(5)
    ]


def _post(api, ids):
    return api.post(URL, {"ids": [str(i) for i in ids]}, format="json")


def test_all_deleted_is_a_200_with_a_result_per_id(api, week):
    ids = [b.pk for b in week]

    response = _post(api, ids)

    body = response.json()
    assert response.status_code == 200
    assert body["success"] is True and body["succeeded_count"] == 5 and body["failed_count"] == 0
    assert [r["id"] for r in body["results"]] == [str(i) for i in ids]
    assert all(r["ok"] and r["error"] is None for r in body["results"])
    assert ResourceSchedule.objects.count() == 0
    assert ResourceSchedule.all_objects.filter(is_deleted=True).count() == 5


def test_some_unknown_is_a_207_and_the_rest_still_go(api, week):
    ghost = uuid.uuid4()

    response = _post(api, [week[0].pk, ghost, week[1].pk])

    body = response.json()
    assert response.status_code == 207
    assert body["success"] is False and body["succeeded_count"] == 2 and body["failed_count"] == 1
    assert body["results"][1] == {"id": str(ghost), "ok": False, "error": "not_found"}
    assert ResourceSchedule.objects.count() == 3


def test_an_already_deleted_booking_reports_not_found_like_an_unknown_one(api, week):
    week[0].soft_delete()

    response = _post(api, [week[0].pk, uuid.uuid4()])

    errors = [r["error"] for r in response.json()["results"]]
    assert response.status_code == 207 and errors == ["not_found", "not_found"]


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"ids": []},
        {"ids": "not a list"},
        {"ids": ["not-a-uuid"]},
        {"ids": [str(uuid.uuid4())] * 2},  # the same id twice
        {"ids": [str(uuid.uuid4()) for _ in range(101)]},  # one too many
    ],
    ids=["missing", "empty", "not-a-list", "bad-uuid", "duplicate", "101"],
)
def test_a_bad_body_is_a_400_and_deletes_nothing(api, week, body):
    response = api.post(URL, body, format="json")

    assert response.status_code == 400
    assert ResourceSchedule.objects.count() == 5


def test_a_hundred_is_allowed(api):
    response = _post(api, [uuid.uuid4() for _ in range(100)])

    assert response.status_code == 207 and response.json()["failed_count"] == 100


def test_it_needs_the_delete_code_and_a_login(week):
    from rest_framework.test import APIClient

    ids = [week[0].pk]

    assert _post(client_for(person(VIEW, MANAGE)), ids).status_code == 403
    assert _post(client_for(person(VIEW)), ids).status_code == 403
    assert _post(APIClient(), ids).status_code in (401, 403)
    assert ResourceSchedule.objects.count() == 5


def test_deleting_a_booking_frees_its_time(api, week):
    from apps.scheduling.services.booking import BookingService

    _post(api, [week[0].pk])

    again = BookingService.book(
        actor=None, resource=week[0].resource, start=week[0].start_time, end=week[0].end_time
    )

    assert again.pk != week[0].pk
