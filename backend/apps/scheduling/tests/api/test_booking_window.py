"""``GET /schedules/?start=&end=`` narrows to the bookings overlapping that window (API-SCH-06)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from apps.scheduling.models import ResourceSchedule
from apps.scheduling.tests.helpers import VIEW, client_for, make_resource, person

pytestmark = pytest.mark.django_db

URL = "/api/v1/scheduling/schedules/"


def at(day, hour):
    return datetime(2026, 11, day, hour, tzinfo=UTC)


def iso(day, hour):
    return at(day, hour).strftime("%Y-%m-%dT%H:%M:%SZ")


@pytest.fixture
def api():
    return client_for(person(VIEW))


@pytest.fixture
def bookings():
    resource = make_resource()
    spans = {
        "early": (at(2, 9), at(2, 12)),
        "middle": (at(3, 9), at(3, 12)),
        "late": (at(4, 9), at(4, 12)),
    }
    return {
        name: ResourceSchedule.objects.create(
            resource=resource, start_time=start, end_time=end, status="Booked"
        )
        for name, (start, end) in spans.items()
    }


def _names(api, bookings, **params):
    response = api.get(URL, params)
    assert response.status_code == 200, response.content
    ids = {row["id"] for row in response.json()}
    return {name for name, booking in bookings.items() if str(booking.pk) in ids}


def test_without_a_window_everything_is_listed(api, bookings):
    assert _names(api, bookings) == {"early", "middle", "late"}


def test_a_window_keeps_what_overlaps_it(api, bookings):
    assert _names(api, bookings, start=iso(3, 0), end=iso(4, 0)) == {"middle"}
    assert _names(api, bookings, start=iso(2, 11), end=iso(3, 10)) == {"early", "middle"}


def test_start_alone_and_end_alone(api, bookings):
    assert _names(api, bookings, start=iso(3, 10)) == {"middle", "late"}
    assert _names(api, bookings, end=iso(3, 10)) == {"early", "middle"}


def test_touching_the_edge_is_not_overlapping(api, bookings):
    assert _names(api, bookings, start=iso(2, 12), end=iso(3, 9)) == set()


def test_an_offset_is_understood(api, bookings):
    # 10:00+01:00 on the 3rd is 09:00 UTC, the instant the middle booking starts
    assert _names(api, bookings, end="2026-11-03T10:00:00+01:00") == {"early"}


@pytest.mark.parametrize(
    ("param", "value"),
    [
        ("start", "2026-11-03T09:00:00"),  # no time zone
        ("end", "2026-11-03"),
        ("start", "yesterday"),
        ("end", "2026-13-45T00:00:00Z"),
    ],
)
def test_a_bad_value_is_a_400(api, bookings, param, value):
    response = api.get(URL, {param: value})

    assert response.status_code == 400


def test_a_blank_value_is_ignored(api, bookings):
    assert _names(api, bookings, start="", end="") == {"early", "middle", "late"}
