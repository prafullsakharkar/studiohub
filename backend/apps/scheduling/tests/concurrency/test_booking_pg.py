# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
Booking races that need real row locks, so they run against PostgreSQL (SQLite ignores row locks).

Two guards hold the rule: the resource row lock in ``BookingService`` and, since migration 0008, an
exclusion constraint in the database. Each thread has its own connection; the data is committed
before the threads start (``transaction=True``).

Checked by hand when written, by taking a guard out and running this file:
- without the constraint (migration 0008 reversed) the direct-write test fails: several rows win;
- without ``select_for_update`` in ``_lock_resource`` the service tests still pass, because the
  constraint catches the losers and the service reports them as the same 409. The lock keeps the
  failure a clean refusal decided in order; the constraint is what makes the outcome safe.
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from django.db import connection

from apps.scheduling.models import ResourceSchedule
from apps.scheduling.services.booking import BookingOverlap, BookingService
from apps.scheduling.tests.helpers import make_resource

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.skipif(
        connection.vendor != "postgresql", reason="row locks are only real on PostgreSQL"
    ),
]


def at(hour, minute=0):
    return datetime(2026, 11, 2, hour, minute, tzinfo=UTC)


def run_parallel(count, work):
    """Run ``work(i)`` in ``count`` threads released together; returns ``[(ok, value_or_error)]``."""
    start = threading.Barrier(count)
    results: list[Any] = [None] * count

    def target(index):
        try:
            start.wait()
            results[index] = (True, work(index))
        except Exception as error:  # the test inspects the exception type
            results[index] = (False, error)
        finally:
            connection.close()

    threads = [threading.Thread(target=target, args=(i,)) for i in range(count)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    return results


def test_eight_bookings_of_one_slot_have_exactly_one_winner():
    resource = make_resource()

    results = run_parallel(
        8,
        lambda i: BookingService.book(actor=None, resource=resource, start=at(9), end=at(12)),
    )

    winners = [value for ok, value in results if ok]
    losers = [value for ok, value in results if not ok]
    assert len(winners) == 1
    assert len(losers) == 7 and all(isinstance(error, BookingOverlap) for error in losers)
    assert ResourceSchedule.objects.filter(resource=resource).count() == 1


def test_bookings_that_overlap_only_partly_still_leave_no_overlapping_pair():
    resource = make_resource()
    # Eight slots that each overlap their neighbours: 09:00-10:00, 09:30-10:30, ... any set of
    # winners must be pairwise disjoint.
    slots = [
        (at(9) + timedelta(minutes=30 * i), at(10) + timedelta(minutes=30 * i)) for i in range(8)
    ]

    results = run_parallel(
        8,
        lambda i: BookingService.book(
            actor=None, resource=resource, start=slots[i][0], end=slots[i][1]
        ),
    )

    won = sorted(
        ((value.start_time, value.end_time) for ok, value in results if ok),
        key=lambda pair: pair[0],
    )
    assert len(won) >= 1
    for (_, first_end), (second_start, _) in zip(won, won[1:], strict=False):
        assert first_end <= second_start
    assert all(isinstance(error, BookingOverlap) for ok, error in results if not ok)


def test_two_bookings_moved_into_the_same_free_slot_have_one_winner():
    resource = make_resource()
    first = BookingService.book(actor=None, resource=resource, start=at(9), end=at(10))
    second = BookingService.book(actor=None, resource=resource, start=at(10), end=at(11))
    targets = [first, second]

    results = run_parallel(
        2,
        lambda i: BookingService.update(
            actor=None,
            booking=targets[i],
            data={"start_time": at(14), "end_time": at(15)},
        ),
    )

    assert sorted(ok for ok, _ in results) == [False, True]
    moved = ResourceSchedule.objects.filter(resource=resource, start_time=at(14)).count()
    assert moved == 1


def test_writes_that_bypass_the_service_still_have_exactly_one_winner():
    """
    Eight threads insert the same slot straight into the table: the database alone decides.

    A loser is told either that the exclusion constraint refused it (23P01) or, when PostgreSQL
    finds two inserts waiting on each other, that it was the deadlock victim (40P01). Either way
    its row is not written. Writers that go through the service never meet the second case: the
    resource lock puts them in a queue.
    """
    resource = make_resource()

    results = run_parallel(
        8,
        lambda i: ResourceSchedule.objects.create(
            resource=resource, start_time=at(9), end_time=at(12), status="Booked"
        ),
    )

    assert sum(1 for ok, _ in results if ok) == 1
    refusals = {getattr(error.__cause__, "sqlstate", None) for ok, error in results if not ok}
    assert refusals <= {"23P01", "40P01"}
    assert ResourceSchedule.objects.filter(resource=resource).count() == 1


def test_different_resources_do_not_wait_for_each_other():
    a, b = make_resource(), make_resource()
    resources = [a, b]

    results = run_parallel(
        2,
        lambda i: BookingService.book(actor=None, resource=resources[i], start=at(9), end=at(12)),
    )

    assert all(ok for ok, _ in results)
