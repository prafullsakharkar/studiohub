"""
Every scheduling route needs exactly the code the contract names (docs/scheduling/CONTRACTS.md
section 5): a caller holding every other code is refused (403), a caller holding that code (plus
view) is let through to the route's own checks (anything but 403).
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

import pytest

from apps.production.tests.factories import ProjectFactory
from apps.scheduling.models import (
    CalendarEvent,
    Holiday,
    Milestone,
    ResourceLeave,
    ResourceSchedule,
)
from apps.scheduling.tests.helpers import (
    ALL_CODES,
    APPROVE,
    CREATE,
    DELETE,
    MANAGE,
    UPDATE,
    VIEW,
    client_for,
    default_calendar,
    make_resource,
    person,
)

pytestmark = pytest.mark.django_db

BASE = "/api/v1/scheduling/"
NOW = datetime(2026, 11, 2, 9, tzinfo=UTC)
LATER = datetime(2026, 11, 2, 10, tzinfo=UTC)
UNKNOWN = str(uuid.uuid4())


def _world():
    """One of everything a route can point at."""
    calendar = default_calendar()
    resource = make_resource()
    project = ProjectFactory.create(code="ACC")
    return {
        "resource": resource,
        "calendar": calendar,
        "booking": ResourceSchedule.objects.create(
            resource=resource, start_time=NOW, end_time=LATER, status="Available"
        ),
        "event": CalendarEvent.objects.create(title="E", start_time=NOW, end_time=LATER),
        "holiday": Holiday.objects.create(
            name="H", holiday_date=date(2026, 12, 25), calendar=calendar
        ),
        "milestone": Milestone.objects.create(
            project=project, name="M", due_date=date(2026, 12, 1)
        ),
        "leave": ResourceLeave.objects.create(
            resource=make_resource(),
            leave_type="Vacation",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 2),
            total_days=2,
        ),
        "project": project,
    }


ZULU = "2026-11-03T09:00:00Z"
ZULU_END = "2026-11-03T10:00:00Z"

#: (name, method, path from the world, body from the world, the one code it needs)
ROUTES = [
    (
        "resource-create",
        "post",
        lambda w: "resources/",
        lambda w: {"name": "N", "code": "ACC-1"},
        MANAGE,
    ),
    (
        "resource-update",
        "patch",
        lambda w: f"resources/{w['resource'].pk}/",
        lambda w: {"location": "x"},
        UPDATE,
    ),
    (
        "resource-delete",
        "delete",
        lambda w: f"resources/{w['resource'].pk}/",
        lambda w: None,
        DELETE,
    ),
    (
        "resource-book",
        "post",
        lambda w: f"resources/{w['resource'].pk}/book/",
        lambda w: {"start_time": ZULU, "end_time": ZULU_END},
        MANAGE,
    ),
    (
        "resource-block",
        "post",
        lambda w: f"resources/{w['resource'].pk}/block/",
        lambda w: {"start_time": ZULU, "end_time": ZULU_END},
        MANAGE,
    ),
    (
        "booking-create",
        "post",
        lambda w: "schedules/",
        lambda w: {
            "resource": str(w["resource"].pk),
            "start_time": ZULU,
            "end_time": ZULU_END,
            "status": "Booked",
        },
        MANAGE,
    ),
    (
        "booking-update",
        "patch",
        lambda w: f"schedules/{w['booking'].pk}/",
        lambda w: {"notes": "x"},
        MANAGE,
    ),
    ("booking-delete", "delete", lambda w: f"schedules/{w['booking'].pk}/", lambda w: None, DELETE),
    (
        "booking-bulk-delete",
        "post",
        lambda w: "schedules/bulk-delete/",
        lambda w: {"ids": [UNKNOWN]},
        DELETE,
    ),
    (
        "event-create",
        "post",
        lambda w: "events/",
        lambda w: {"title": "T", "start_time": ZULU, "end_time": ZULU_END},
        CREATE,
    ),
    (
        "event-update",
        "patch",
        lambda w: f"events/{w['event'].pk}/",
        lambda w: {"title": "U"},
        UPDATE,
    ),
    ("event-delete", "delete", lambda w: f"events/{w['event'].pk}/", lambda w: None, DELETE),
    (
        "leave-create",
        "post",
        lambda w: "leaves/",
        lambda w: {"leave_type": "Vacation", "start_date": "2027-01-04", "end_date": "2027-01-05"},
        CREATE,
    ),
    ("leave-approve", "post", lambda w: f"leaves/{w['leave'].pk}/approve/", lambda w: {}, APPROVE),
    (
        "leave-reject",
        "post",
        lambda w: f"leaves/{w['leave'].pk}/reject/",
        lambda w: {"rejection_reason": "no"},
        APPROVE,
    ),
    ("leave-delete", "delete", lambda w: f"leaves/{w['leave'].pk}/", lambda w: None, DELETE),
    (
        "holiday-create",
        "post",
        lambda w: "holidays/",
        lambda w: {"name": "N", "holiday_date": "2027-01-01"},
        MANAGE,
    ),
    (
        "holiday-update",
        "patch",
        lambda w: f"holidays/{w['holiday'].pk}/",
        lambda w: {"name": "U"},
        MANAGE,
    ),
    ("holiday-delete", "delete", lambda w: f"holidays/{w['holiday'].pk}/", lambda w: None, MANAGE),
    (
        "calendar-create",
        "post",
        lambda w: "calendars/",
        lambda w: {"code": "NEWCAL", "name": "N"},
        MANAGE,
    ),
    (
        "calendar-update",
        "patch",
        lambda w: f"calendars/{w['calendar'].pk}/",
        lambda w: {"name": "U"},
        MANAGE,
    ),
    (
        "calendar-default",
        "post",
        lambda w: f"calendars/{w['calendar'].pk}/set-default/",
        lambda w: {},
        MANAGE,
    ),
    (
        "milestone-create",
        "post",
        lambda w: "milestones/",
        lambda w: {"project_id": str(w["project"].pk), "name": "N", "due_date": "2027-01-01"},
        MANAGE,
    ),
    (
        "milestone-update",
        "patch",
        lambda w: f"milestones/{w['milestone'].pk}/",
        lambda w: {"notes": "x"},
        MANAGE,
    ),
    (
        "milestone-complete",
        "post",
        lambda w: f"milestones/{w['milestone'].pk}/complete/",
        lambda w: {},
        MANAGE,
    ),
    (
        "milestone-reopen",
        "post",
        lambda w: f"milestones/{w['milestone'].pk}/reopen/",
        lambda w: {},
        MANAGE,
    ),
    (
        "milestone-delete",
        "delete",
        lambda w: f"milestones/{w['milestone'].pk}/",
        lambda w: None,
        MANAGE,
    ),
]
IDS = [route[0] for route in ROUTES]


def _call(client, route, world):
    _, method, path, body, _ = route
    url = BASE + path(world)
    payload = body(world)
    if payload is None:
        return getattr(client, method)(url)
    return getattr(client, method)(url, payload, format="json")


@pytest.mark.parametrize("route", ROUTES, ids=IDS)
def test_a_caller_missing_only_this_code_is_refused(route):
    world = _world()
    needs = route[4]
    holder = client_for(person(*[code for code in ALL_CODES if code != needs]))

    assert _call(holder, route, world).status_code == 403


@pytest.mark.parametrize("route", ROUTES, ids=IDS)
def test_a_caller_with_this_code_gets_past_the_gate(route):
    world = _world()
    needs = route[4]
    holder = client_for(person(VIEW, needs))

    assert _call(holder, route, world).status_code != 403


@pytest.mark.parametrize("route", ROUTES, ids=IDS)
def test_a_caller_with_only_view_can_change_nothing(route):
    world = _world()
    reader = client_for(person(VIEW))

    assert _call(reader, route, world).status_code == 403


def test_every_route_needs_a_login():
    from rest_framework.test import APIClient

    world = _world()
    anonymous = APIClient()

    for route in ROUTES:
        assert _call(anonymous, route, world).status_code in (401, 403), route[0]
