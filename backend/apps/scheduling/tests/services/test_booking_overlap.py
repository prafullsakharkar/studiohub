# Django adds <fk>_id attributes at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
A resource cannot be booked twice at the same time (DOM-SCH-04, decision Q32 option B).

Booked, Blocked and Overbooked bookings of one resource may not overlap; adjacent ones are fine,
Available never blocks, deleted ones are ignored. Refused with 409 ``booking_overlap``.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from apps.scheduling.models import CalendarEvent, ResourceSchedule
from apps.scheduling.services.booking import BookingOverlap, BookingService
from apps.scheduling.tests.helpers import ALL_CODES, admin_client, client_for, make_resource, person

pytestmark = pytest.mark.django_db

BASE = "/api/v1/scheduling/"


def at(hour, minute=0, day=2):
    return datetime(2026, 11, day, hour, minute, tzinfo=UTC)


def iso(hour, minute=0, day=2):
    return at(hour, minute, day).strftime("%Y-%m-%dT%H:%M:%SZ")


def _book(resource, start, end, status="Booked", **extra):
    return ResourceSchedule.objects.create(
        resource=resource, start_time=start, end_time=end, status=status, **extra
    )


@pytest.fixture
def resource():
    return make_resource()


@pytest.fixture
def api():
    return admin_client()


def _post(api, resource, start, end, status="Booked", **extra):
    return api.post(
        f"{BASE}schedules/",
        {
            "resource": str(resource.pk),
            "start_time": start,
            "end_time": end,
            "status": status,
            **extra,
        },
        format="json",
    )


class TestTheRule:
    def test_an_overlapping_booking_is_a_409_naming_the_other(self, api, resource):
        first = _book(resource, at(9), at(12))

        response = _post(api, resource, iso(11), iso(14))

        assert response.status_code == 409, response.content
        text = response.content.decode()
        assert "booking_overlap" in text and str(first.pk) in text
        assert ResourceSchedule.objects.count() == 1

    @pytest.mark.parametrize(
        ("start", "end"),
        [
            (at(9), at(12)),  # the same slot
            (at(10), at(11)),  # inside
            (at(8), at(13)),  # around
            (at(8), at(9, 30)),  # across the start
            (at(11, 30), at(14)),  # across the end
        ],
        ids=["same", "inside", "around", "start", "end"],
    )
    def test_every_kind_of_overlap_is_refused(self, resource, start, end):
        _book(resource, at(9), at(12))

        with pytest.raises(BookingOverlap):
            BookingService.book(actor=None, resource=resource, start=start, end=end)

    def test_adjacent_bookings_are_fine_either_side(self, api, resource):
        _book(resource, at(9), at(12))

        assert _post(api, resource, iso(12), iso(15)).status_code == 201
        assert _post(api, resource, iso(6), iso(9)).status_code == 201

    @pytest.mark.parametrize("existing", ["Booked", "Blocked", "Overbooked"])
    @pytest.mark.parametrize("incoming", ["Booked", "Blocked", "Overbooked"])
    def test_booked_blocked_and_overbooked_all_occupy_the_time(
        self, api, resource, existing, incoming
    ):
        _book(resource, at(9), at(12), status=existing)

        assert _post(api, resource, iso(10), iso(11), status=incoming).status_code == 409

    def test_available_never_blocks_and_is_never_blocked(self, api, resource):
        _book(resource, at(9), at(12), status="Available")

        assert _post(api, resource, iso(10), iso(11)).status_code == 201  # over an Available slot
        assert _post(api, resource, iso(10), iso(11), status="Available").status_code == 201

    def test_another_resource_is_not_affected(self, api, resource):
        _book(resource, at(9), at(12))

        assert _post(api, make_resource(), iso(9), iso(12)).status_code == 201

    def test_a_deleted_booking_does_not_block(self, api, resource):
        gone = _book(resource, at(9), at(12))
        gone.soft_delete()

        assert _post(api, resource, iso(9), iso(12)).status_code == 201

    def test_book_and_block_actions_follow_the_rule(self, api, resource):
        _book(resource, at(9), at(12))
        for action in ("book", "block"):
            response = api.post(
                f"{BASE}resources/{resource.pk}/{action}/",
                {"start_time": iso(10), "end_time": iso(11)},
                format="json",
            )

            assert response.status_code == 409, action
        free = api.post(
            f"{BASE}resources/{resource.pk}/block/",
            {"start_time": iso(12), "end_time": iso(13), "reason": "maintenance"},
            format="json",
        )
        assert free.status_code == 201 and free.json()["status"] == "Blocked"


class TestMovingAndEditing:
    def test_moving_into_an_overlap_is_refused_and_leaves_the_booking_as_it_was(
        self, api, resource
    ):
        _book(resource, at(9), at(12))
        mine = _book(resource, at(13), at(15))

        response = api.patch(
            f"{BASE}schedules/{mine.pk}/",
            {"start_time": iso(11), "end_time": iso(14)},
            format="json",
        )

        assert response.status_code == 409
        mine.refresh_from_db()
        assert (mine.start_time, mine.end_time) == (at(13), at(15))

    def test_a_booking_can_shrink_or_move_within_its_own_slot(self, api, resource):
        mine = _book(resource, at(9), at(12))

        shrunk = api.patch(f"{BASE}schedules/{mine.pk}/", {"end_time": iso(11)}, format="json")
        shifted = api.patch(
            f"{BASE}schedules/{mine.pk}/",
            {"start_time": iso(9, 30), "end_time": iso(11, 30)},
            format="json",
        )

        assert shrunk.status_code == 200 and shifted.status_code == 200

    def test_moving_to_another_resource_checks_that_resource(self, api, resource):
        other = make_resource()
        _book(other, at(9), at(12))
        mine = _book(resource, at(9), at(12))

        response = api.patch(
            f"{BASE}schedules/{mine.pk}/", {"resource": str(other.pk)}, format="json"
        )

        assert response.status_code == 409

    def test_turning_an_available_slot_into_booked_checks_the_time(self, api, resource):
        _book(resource, at(9), at(12))
        slot = _book(resource, at(10), at(11), status="Available")

        response = api.patch(f"{BASE}schedules/{slot.pk}/", {"status": "Booked"}, format="json")

        assert response.status_code == 409

    def test_notes_event_and_task_can_be_edited_without_touching_the_time(self, api, resource):
        booking = _book(resource, at(9), at(12))
        _book(resource, at(12), at(13))  # right next to it

        response = api.patch(f"{BASE}schedules/{booking.pk}/", {"notes": "kept"}, format="json")

        assert response.status_code == 200
        booking.refresh_from_db()
        assert booking.notes == "kept"

    def test_flagging_overbooked_through_resolve_keeps_the_slot_occupied(self, api, resource):
        booked = _book(resource, at(9), at(12))
        ResourceSchedule.objects.filter(pk=booked.pk).update(status="Overbooked")

        assert _post(api, resource, iso(10), iso(11)).status_code == 409


class TestWhatTheRefusalReveals:
    def _setup(self):
        event = CalendarEvent.objects.create(
            title="Secret reshoot", start_time=at(9), end_time=at(12), visibility="Private"
        )
        resource = make_resource()
        _book(resource, at(9), at(12), event=event)
        return resource

    def test_the_title_of_an_event_the_caller_cannot_see_is_not_in_the_refusal(self):
        resource = self._setup()
        planner = client_for(person(*ALL_CODES))  # not an admin, not the event's creator

        response = _post(planner, resource, iso(10), iso(11))

        assert response.status_code == 409
        assert "Secret reshoot" not in response.content.decode()

    def test_an_admin_sees_the_title(self):
        resource = self._setup()

        response = _post(admin_client(), resource, iso(10), iso(11))

        assert response.status_code == 409 and "Secret reshoot" in response.content.decode()


class TestTheStamps:
    def test_who_made_and_changed_a_booking_is_recorded(self, resource):
        user = person(*ALL_CODES)
        booking = BookingService.book(actor=user, resource=resource, start=at(9), end=at(10))
        other = person(*ALL_CODES)

        BookingService.update(actor=other, booking=booking, data={"notes": "x"})

        booking.refresh_from_db()
        assert booking.created_by_id == user.pk and booking.updated_by_id == other.pk


class TestTheDatabaseHoldsTheSameRule:
    """Migration 0008: a write that bypasses the service (the admin, raw SQL) cannot overlap."""

    @staticmethod
    def _refused(resource, start, end, status="Booked"):
        from django.db import IntegrityError, transaction

        with (
            pytest.raises(IntegrityError, match="scheduling_booking_no_overlap"),
            transaction.atomic(),
        ):
            ResourceSchedule.objects.create(
                resource=resource, start_time=start, end_time=end, status=status
            )

    def test_an_overlap_made_directly_is_refused(self, resource):
        _book(resource, at(9), at(12))

        self._refused(resource, at(11), at(13))
        self._refused(resource, at(9), at(12))
        self._refused(resource, at(8), at(13), status="Blocked")

    def test_adjacent_other_resource_available_and_deleted_are_not_conflicts(self, resource):
        first = _book(resource, at(9), at(12))
        _book(resource, at(12), at(14))  # adjacent after
        _book(resource, at(7), at(9))  # adjacent before
        _book(resource, at(10), at(11), status="Available")  # Available never blocks
        _book(make_resource(), at(9), at(12))  # another resource
        first.soft_delete()

        _book(resource, at(10), at(11))  # the slot of a deleted booking is free

        assert ResourceSchedule.all_objects.filter(resource=resource).count() == 5

    def test_overbooked_occupies_time_in_the_database_too(self, resource):
        _book(resource, at(9), at(12), status="Overbooked")

        self._refused(resource, at(10), at(11))

    def test_turning_an_available_slot_into_a_booking_into_an_overlap_is_refused(self, resource):
        from django.db import IntegrityError, transaction

        _book(resource, at(9), at(12))
        slot = _book(resource, at(10), at(11), status="Available")

        with (
            pytest.raises(IntegrityError, match="scheduling_booking_no_overlap"),
            transaction.atomic(),
        ):
            ResourceSchedule.objects.filter(pk=slot.pk).update(status="Booked")

    def test_if_the_constraint_ever_fires_inside_the_service_it_is_the_same_409(
        self, resource, monkeypatch
    ):
        """The lock normally decides first; take the Python check away to see the database speak."""
        import apps.scheduling.services.booking as booking_module

        first = _book(resource, at(9), at(12))
        real = booking_module.find_overlap
        calls = {"n": 0}

        def blind_the_first_check(*args, **kwargs):
            calls["n"] += 1
            return None if calls["n"] == 1 else real(*args, **kwargs)

        monkeypatch.setattr(booking_module, "find_overlap", blind_the_first_check)

        with pytest.raises(BookingOverlap) as error:
            BookingService.book(actor=None, resource=resource, start=at(10), end=at(11))

        assert str(first.pk) in str(error.value.detail)
        assert ResourceSchedule.objects.filter(resource=resource).count() == 1

    def test_and_the_same_when_an_edit_reaches_it(self, resource, monkeypatch):
        import apps.scheduling.services.booking as booking_module

        _book(resource, at(9), at(12))
        mine = _book(resource, at(13), at(15))
        real = booking_module.find_overlap
        calls = {"n": 0}

        def blind_the_first_check(*args, **kwargs):
            calls["n"] += 1
            return None if calls["n"] == 1 else real(*args, **kwargs)

        monkeypatch.setattr(booking_module, "find_overlap", blind_the_first_check)

        with pytest.raises(BookingOverlap):
            BookingService.update(
                actor=None, booking=mine, data={"start_time": at(11), "end_time": at(14)}
            )

        mine.refresh_from_db()
        assert (mine.start_time, mine.end_time) == (at(13), at(15))
