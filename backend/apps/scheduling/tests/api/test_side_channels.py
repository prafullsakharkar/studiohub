"""
Hidden values cannot be read back through search, filters or ordering (SEC-SCH-01, API-SCH-01,
API-SCH-02): the notes of a booking and the reasons of a leave are not searchable, the pay rate
cannot be ordered by without ``schedule.view_rates``, and no query parameter filters on them.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest

from apps.scheduling.models import ResourceLeave, ResourceSchedule
from apps.scheduling.tests.helpers import (
    ALL_CODES,
    APPROVE,
    VIEW,
    client_for,
    default_calendar,
    make_resource,
    person,
)

pytestmark = pytest.mark.django_db

BASE = "/api/v1/scheduling/"
SECRET = "zebraquartz"
VIEW_RATES = "schedule.view_rates"


@pytest.fixture(autouse=True)
def calendar():
    return default_calendar()


def _ids(response):
    assert response.status_code == 200, response.content
    return [row["id"] for row in response.json()]


class TestBookingNotes:
    def _bookings(self):
        a, b = make_resource(name="Alpha", code="AAA"), make_resource(name="Beta", code="BBB")
        noted = ResourceSchedule.objects.create(
            resource=a,
            start_time=datetime(2026, 11, 2, 9, tzinfo=UTC),
            end_time=datetime(2026, 11, 2, 10, tzinfo=UTC),
            status="Booked",
            notes=f"call about {SECRET}",
        )
        plain = ResourceSchedule.objects.create(
            resource=b,
            start_time=datetime(2026, 11, 2, 9, tzinfo=UTC),
            end_time=datetime(2026, 11, 2, 10, tzinfo=UTC),
            status="Booked",
            notes="nothing",
        )
        return noted, plain

    @pytest.mark.parametrize("who", ["reader", "planner"])
    def test_searching_for_text_in_a_note_finds_nothing(self, who):
        self._bookings()
        user = person(VIEW) if who == "reader" else person(*ALL_CODES)

        found = client_for(user).get(f"{BASE}schedules/", {"search": SECRET})

        assert _ids(found) == []

    def test_search_still_finds_a_booking_by_its_resource(self):
        noted, plain = self._bookings()

        found = client_for(person(VIEW)).get(f"{BASE}schedules/", {"search": "alpha"})
        by_code = client_for(person(VIEW)).get(f"{BASE}schedules/", {"search": "BBB"})

        assert _ids(found) == [str(noted.pk)] and _ids(by_code) == [str(plain.pk)]

    @pytest.mark.parametrize("param", ["notes", "notes__icontains", "notes__contains"])
    def test_no_query_parameter_filters_on_notes(self, param):
        noted, plain = self._bookings()

        listed = client_for(person(VIEW)).get(f"{BASE}schedules/", {param: SECRET})

        assert sorted(_ids(listed)) == sorted([str(noted.pk), str(plain.pk)])  # not narrowed


class TestLeaveReasons:
    def _leave(self):
        resource = make_resource(name="Gamma", code="GGG")
        return ResourceLeave.objects.create(
            resource=resource,
            leave_type="Vacation",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 2),
            total_days=2,
            reason=f"surgery {SECRET}",
            status="Rejected",
            rejection_reason=f"no cover {SECRET}",
        )

    @pytest.mark.parametrize("codes", [(VIEW,), (VIEW, APPROVE), tuple(ALL_CODES)])
    def test_searching_for_a_reason_finds_nothing_whoever_asks(self, codes):
        self._leave()

        found = client_for(person(*codes)).get(f"{BASE}leaves/", {"search": SECRET})

        assert _ids(found) == []

    def test_the_owner_cannot_find_their_own_leave_by_its_reason_either(self):
        owner = person(VIEW)
        leave = self._leave()
        type(leave.resource).objects.filter(pk=leave.resource_id).update(user=owner)

        assert _ids(client_for(owner).get(f"{BASE}leaves/", {"search": SECRET})) == []

    def test_search_still_finds_leave_by_its_resource(self):
        leave = self._leave()

        found = client_for(person(VIEW)).get(f"{BASE}leaves/", {"search": "gamma"})

        assert _ids(found) == [str(leave.pk)]

    @pytest.mark.parametrize("param", ["reason", "reason__icontains", "rejection_reason"])
    def test_no_query_parameter_filters_on_a_reason(self, param):
        leave = self._leave()
        other = ResourceLeave.objects.create(
            resource=make_resource(),
            leave_type="Vacation",
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 2),
            total_days=2,
            reason="other",
        )

        listed = client_for(person(VIEW)).get(f"{BASE}leaves/", {param: SECRET})

        assert sorted(_ids(listed)) == sorted([str(leave.pk), str(other.pk)])


class TestPayRates:
    def _resources(self):
        # default order is by name; by rate it is Bravo, Charlie, Alpha
        alpha = make_resource(name="Alpha", hourly_rate_usd=30)
        bravo = make_resource(name="Bravo", hourly_rate_usd=10)
        charlie = make_resource(name="Charlie", hourly_rate_usd=20)
        return [str(r.pk) for r in (alpha, bravo, charlie)]

    def test_without_the_code_ordering_by_rate_is_ignored(self):
        alpha, bravo, charlie = self._resources()
        reader = client_for(person(VIEW))

        ascending = _ids(reader.get(f"{BASE}resources/", {"ordering": "hourly_rate_usd"}))
        descending = _ids(reader.get(f"{BASE}resources/", {"ordering": "-hourly_rate_usd"}))

        assert ascending == descending == [alpha, bravo, charlie]  # the default order

    def test_the_rates_themselves_are_hidden_without_the_code(self):
        self._resources()

        rows = client_for(person(VIEW)).get(f"{BASE}resources/").json()

        assert {row["hourly_rate_usd"] for row in rows} == {None}

    def test_with_the_code_ordering_by_rate_works(self):
        alpha, bravo, charlie = self._resources()
        holder = client_for(person(VIEW, VIEW_RATES))

        ascending = _ids(holder.get(f"{BASE}resources/", {"ordering": "hourly_rate_usd"}))
        descending = _ids(holder.get(f"{BASE}resources/", {"ordering": "-hourly_rate_usd"}))

        assert ascending == [bravo, charlie, alpha]
        assert descending == [alpha, charlie, bravo]

    def test_a_valid_ordering_next_to_the_rate_still_applies(self):
        alpha, bravo, charlie = self._resources()
        reader = client_for(person(VIEW))

        ids = _ids(reader.get(f"{BASE}resources/", {"ordering": "-name,hourly_rate_usd"}))

        assert ids == [charlie, bravo, alpha]

    def test_being_a_resource_yourself_does_not_unlock_ordering_by_everyones_rate(self):
        alpha, bravo, charlie = self._resources()
        me = person(VIEW)
        make_resource(name="Me", user=me, hourly_rate_usd=5)

        ids = _ids(client_for(me).get(f"{BASE}resources/", {"ordering": "hourly_rate_usd"}))

        assert ids[:3] == [alpha, bravo, charlie]  # default (name) order: Alpha, Bravo, Charlie, Me

    @pytest.mark.parametrize(
        "param", ["hourly_rate_usd", "hourly_rate_usd__gte", "hourly_rate_usd__lt"]
    )
    def test_no_query_parameter_filters_on_the_rate(self, param):
        ids = self._resources()

        listed = _ids(client_for(person(VIEW)).get(f"{BASE}resources/", {param: "20"}))

        assert sorted(listed) == sorted(ids)
