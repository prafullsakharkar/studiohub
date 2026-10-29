"""
The time policy (docs/scheduling/CONTRACTS.md section 1, decision Q31): a date-time needs its time
zone. `Z` or an offset is accepted and stored in UTC; one with no offset, which used to be taken as
UTC without a word, is a 400, on every endpoint that takes a moment.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from apps.scheduling.models import CalendarEvent, ResourceSchedule
from apps.scheduling.tests.helpers import admin_client, make_resource

pytestmark = pytest.mark.django_db

BASE = "/api/v1/scheduling/"
NAIVE = "2026-11-02T09:00:00"
NAIVE_END = "2026-11-02T10:00:00"
ZULU = "2026-11-02T09:00:00Z"
ZULU_END = "2026-11-02T10:00:00Z"


@pytest.fixture
def api():
    return admin_client()


@pytest.fixture
def resource():
    return make_resource()


def _event(api, **extra):
    return api.post(
        f"{BASE}events/",
        {"title": "Review", "start_time": ZULU, "end_time": ZULU_END, **extra},
        format="json",
    )


def _booking(api, resource, **extra):
    return api.post(
        f"{BASE}schedules/",
        {
            "resource": str(resource.pk),
            "start_time": ZULU,
            "end_time": ZULU_END,
            "status": "Booked",
            **extra,
        },
        format="json",
    )


class TestEvents:
    def test_a_naive_start_or_end_is_a_400_that_says_what_to_add(self, api):
        for body in (
            {"start_time": NAIVE},
            {"end_time": NAIVE_END},
            {"start_time": NAIVE, "end_time": NAIVE_END},
        ):
            response = _event(api, **body)

            assert response.status_code == 400, body
            assert "time zone" in response.content.decode()
        assert CalendarEvent.objects.count() == 0

    def test_z_is_accepted_and_stored_as_utc(self, api):
        response = _event(api)

        assert response.status_code == 201, response.content
        assert CalendarEvent.objects.get().start_time == datetime(2026, 11, 2, 9, tzinfo=UTC)
        assert response.json()["start_time"] == ZULU

    def test_an_offset_is_converted_to_utc(self, api):
        response = _event(
            api, start_time="2026-11-02T10:00:00+01:00", end_time="2026-11-02T11:30:00+01:00"
        )

        assert response.status_code == 201, response.content
        event = CalendarEvent.objects.get()
        assert event.start_time == datetime(2026, 11, 2, 9, tzinfo=UTC)
        assert event.end_time == datetime(2026, 11, 2, 10, 30, tzinfo=UTC)
        assert response.json()["start_time"].endswith("Z")

    def test_a_negative_offset(self, api):
        response = _event(
            api, start_time="2026-11-02T01:00:00-08:00", end_time="2026-11-02T02:00:00-08:00"
        )

        assert response.status_code == 201
        assert CalendarEvent.objects.get().start_time == datetime(2026, 11, 2, 9, tzinfo=UTC)

    @pytest.mark.parametrize(
        "value", ["2026-11-02", "not a date", "2026-13-45T09:00:00Z", "", 12345]
    )
    def test_other_nonsense_is_still_a_400(self, api, value):
        assert _event(api, start_time=value).status_code == 400

    def test_end_before_start_is_still_a_400(self, api):
        response = _event(api, start_time=ZULU_END, end_time=ZULU)

        assert response.status_code == 400 and "end" in response.content.decode().lower()

    def test_editing_a_moment_follows_the_same_rule(self, api):
        assert _event(api).status_code == 201
        event_id = CalendarEvent.objects.get().pk

        naive = api.patch(f"{BASE}events/{event_id}/", {"start_time": NAIVE}, format="json")
        aware = api.patch(
            f"{BASE}events/{event_id}/", {"start_time": "2026-11-02T09:30:00+00:00"}, format="json"
        )

        assert naive.status_code == 400 and aware.status_code == 200
        assert CalendarEvent.objects.get().start_time == datetime(2026, 11, 2, 9, 30, tzinfo=UTC)


class TestBookings:
    def test_a_naive_booking_is_a_400(self, api, resource):
        for body in ({"start_time": NAIVE}, {"end_time": NAIVE_END}):
            response = _booking(api, resource, **body)

            assert response.status_code == 400, body
            assert "time zone" in response.content.decode()
        assert ResourceSchedule.objects.count() == 0

    def test_an_aware_booking_is_stored_in_utc(self, api, resource):
        response = _booking(
            api,
            resource,
            start_time="2026-11-02T10:00:00+01:00",
            end_time="2026-11-02T11:00:00+01:00",
        )

        assert response.status_code == 201, response.content
        assert ResourceSchedule.objects.get().start_time == datetime(2026, 11, 2, 9, tzinfo=UTC)

    def test_editing_a_booking_follows_the_same_rule(self, api, resource):
        booking_id = _booking(api, resource).json()["id"]

        response = api.patch(
            f"{BASE}schedules/{booking_id}/", {"end_time": NAIVE_END}, format="json"
        )

        assert response.status_code == 400
        assert ResourceSchedule.objects.get().end_time == datetime(2026, 11, 2, 10, tzinfo=UTC)

    @pytest.mark.parametrize("action", ["book", "block"])
    def test_the_book_and_block_actions_follow_it_too(self, api, resource, action):
        url = f"{BASE}resources/{resource.pk}/{action}/"

        naive = api.post(url, {"start_time": NAIVE, "end_time": NAIVE_END}, format="json")
        aware = api.post(url, {"start_time": ZULU, "end_time": ZULU_END}, format="json")

        assert naive.status_code == 400 and "time zone" in naive.content.decode()
        assert aware.status_code == 201, aware.content
        assert ResourceSchedule.objects.count() == 1

    @pytest.mark.parametrize("action", ["book", "block"])
    def test_book_and_block_that_end_when_they_start_are_refused_not_a_500(
        self, api, resource, action
    ):
        response = api.post(
            f"{BASE}resources/{resource.pk}/{action}/",
            {"start_time": ZULU, "end_time": ZULU},
            format="json",
        )

        assert response.status_code == 400
        assert ResourceSchedule.objects.count() == 0

    def test_a_booking_that_ends_when_it_starts_is_refused_not_a_500(self, api, resource):
        response = _booking(api, resource, end_time=ZULU)

        assert response.status_code in (400, 409)
        assert ResourceSchedule.objects.count() == 0


class TestTheDatabaseHoldsTheSameLine:
    def test_a_booking_must_end_after_it_starts(self, resource):
        from django.db import IntegrityError, transaction

        with pytest.raises(IntegrityError), transaction.atomic():
            ResourceSchedule.objects.create(
                resource=resource, start_time=datetime(2026, 11, 2, 9, tzinfo=UTC),
                end_time=datetime(2026, 11, 2, 9, tzinfo=UTC), status="Booked",
            )  # fmt: skip

    def test_an_event_may_have_no_duration_but_not_a_negative_one(self):
        from django.db import IntegrityError, transaction

        same = datetime(2026, 11, 2, 9, tzinfo=UTC)
        CalendarEvent.objects.create(title="Point", start_time=same, end_time=same)

        with pytest.raises(IntegrityError), transaction.atomic():
            CalendarEvent.objects.create(
                title="Backwards", start_time=datetime(2026, 11, 2, 10, tzinfo=UTC), end_time=same
            )
