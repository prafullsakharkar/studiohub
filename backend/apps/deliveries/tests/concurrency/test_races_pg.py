# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
Races that need real row locks, so they run against PostgreSQL (SQLite ignores row locks).

Each thread has its own database connection; the data is committed before the threads start
(``transaction=True``).

Checked by hand when written, by taking a guard out and running this file:
- without the package row lock in ``DeliveryService`` the two send tests fail;
- without the counter row lock the numbering test fails;
- the add-versus-send and double-add tests still passed without the package lock. They hold the
  invariant through other guards (the item save guard, the unique constraint), so they test the
  outcome, not the lock.
"""

from __future__ import annotations

import threading
from collections import Counter
from typing import Any

import pytest
from django.db import connection

from apps.audit.models import AuditLog
from apps.deliveries.exceptions import DeliveryNotEditable, InvalidTransition
from apps.deliveries.models import DeliveryItemFile, DeliveryPackage
from apps.deliveries.services.package import DeliveryService
from apps.deliveries.tests.helpers import make_package, prepared_package, published_version
from apps.production.tests.factories import ProjectFactory

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.skipif(
        connection.vendor != "postgresql", reason="row locks are only real on PostgreSQL"
    ),
]


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


def test_two_sends_of_the_same_delivery_have_one_success_and_one_conflict():
    package = prepared_package()

    results = run_parallel(2, lambda _: DeliveryService.send(actor=None, package=package))

    outcomes = Counter("ok" if ok else type(value).__name__ for ok, value in results)
    assert outcomes == {"ok": 1, "InvalidTransition": 1}
    sent = DeliveryPackage.objects.get(pk=package.pk)
    assert sent.status == "Submitted" and sent.sent_at is not None
    submissions = AuditLog.objects.filter(
        target_id=str(package.pk), description__contains="submitted"
    )
    assert submissions.count() == 1  # recorded once, not twice


def test_many_sends_still_send_once():
    package = prepared_package()

    results = run_parallel(5, lambda _: DeliveryService.send(actor=None, package=package))

    assert Counter(ok for ok, _ in results) == {True: 1, False: 4}
    assert all(isinstance(v, InvalidTransition) for ok, v in results if not ok)


def test_concurrent_creates_get_distinct_consecutive_codes():
    project = ProjectFactory.create(code="RACE")

    results = run_parallel(
        8,
        lambda _: (
            DeliveryService.create(
                actor=None, data={"name": "Turnover", "project_id": project.pk}
            ).code
        ),
    )

    assert all(ok for ok, _ in results), [v for ok, v in results if not ok]
    assert sorted(v for _, v in results) == [f"DLV-RACE-{n:04d}" for n in range(1, 9)]


def _send_while_adding(package, extra):
    """Send ``package`` in one thread and add ``extra`` to it in another, together."""
    return run_parallel(
        2,
        lambda i: (
            DeliveryService.send(actor=None, package=package)
            if i == 0
            else DeliveryService.add_version(actor=None, package=package, version_id=extra.pk)
        ),
    )


def test_an_item_added_while_the_delivery_is_sent_is_either_in_the_send_or_refused():
    """Never half and half: a Submitted delivery has no unfrozen item, whichever request wins."""
    for _ in range(6):
        package = prepared_package()
        extra = published_version(package.project)

        send, add = _send_while_adding(package, extra)

        assert send[0], send[1]
        sent = DeliveryPackage.objects.get(pk=package.pk)
        assert sent.status == "Submitted"
        items = sent.versions.count()
        assert items == (2 if add[0] else 1)
        if not add[0]:
            assert isinstance(add[1], DeliveryNotEditable)
        assert not DeliveryItemFile.objects.filter(
            item__delivery=sent, frozen_at__isnull=True
        ).exists(), "an item of a sent delivery was left unfrozen"
        assert sent.checksums["version_count"] == items


def test_two_adds_of_the_same_version_make_one_item():
    package = make_package()
    version = published_version(package.project)

    results = run_parallel(
        2, lambda _: DeliveryService.add_version(actor=None, package=package, version_id=version.pk)
    )

    assert Counter(ok for ok, _ in results) == {True: 1, False: 1}
    assert package.versions.count() == 1
