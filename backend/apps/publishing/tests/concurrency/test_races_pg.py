"""
Races that need real row locks, so they run against PostgreSQL (SQLite ignores row locks).

Each thread has its own database connection; the data is committed before the threads start
(``transaction=True``). Checked by hand on 2026-10-27 that each test fails when its guard is taken
out: numbering without the counter row lock, revoke without the file row lock, registration
without the unique constraint's IntegrityError handling.
"""

from __future__ import annotations

import threading
from collections import Counter
from typing import Any

import pytest
from django.db import connection

from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.exceptions import InvalidTransition, PathAlreadyRegistered
from apps.publishing.models import PublishedFile, PublishedFileEvent, PublishItem
from apps.publishing.services.files import PublishedFileService
from apps.publishing.services.jobs import create_job
from apps.publishing.tests.helpers import (
    OTHER_SHA,
    member,
    published_version,
    registration,
    request_for,
    storage_root,
)

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.skipif(
        connection.vendor != "postgresql", reason="row locks are only real on PostgreSQL"
    ),
]

BODY = {
    "name": "Rig export",
    "entity_type": "Shot",
    "entity_id": "x",
    "entity_code": "SH010",
    "entity_name": "Opening",
    "dcc_tool": "Maya",
    "source_file": "a.ma",
}


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


def test_concurrent_job_creates_get_distinct_consecutive_codes(project):
    results = run_parallel(
        8, lambda _: create_job(actor=None, data={**BODY, "project_id": str(project.pk)}).code
    )

    assert all(ok for ok, _ in results), [value for ok, value in results if not ok]
    codes = sorted(value for _, value in results)
    assert codes == [f"PUB-PUBP-{n:04d}" for n in range(1, 9)]
    assert PublishItem.objects.count() == 8


def test_concurrent_registrations_of_the_same_file_make_one_row(project, root):
    user = member(project, P.CREATE)
    version = published_version(project)
    data = registration(version, root)

    results = run_parallel(
        6,
        lambda _: PublishedFileService.register(
            actor=user, request=request_for(user), version_id=version.pk, data=data
        ),
    )

    assert all(ok for ok, _ in results), [value for ok, value in results if not ok]
    assert Counter(created for _, (_file, created) in results) == {True: 1, False: 5}
    assert len({file.pk for _, (file, _) in results}) == 1
    assert PublishedFile.objects.count() == 1
    assert PublishedFileEvent.objects.filter(kind="registered").count() == 1


def test_concurrent_registrations_with_different_content_have_exactly_one_winner(project, root):
    user = member(project, P.CREATE)
    version = published_version(project)
    shas = [f"{i:x}" * 64 for i in range(1, 7)]

    results = run_parallel(
        6,
        lambda i: PublishedFileService.register(
            actor=user,
            request=request_for(user),
            version_id=version.pk,
            data=registration(version, root, sha256=shas[i]),
        ),
    )

    winners = [value for ok, value in results if ok]
    losers = [value for ok, value in results if not ok]
    assert len(winners) == 1
    assert len(losers) == 5 and all(isinstance(e, PathAlreadyRegistered) for e in losers)
    stored = PublishedFile.objects.get()
    assert stored.sha256 == winners[0][0].sha256


def test_concurrent_revokes_have_one_success_and_one_conflict(project, root):
    user = member(project, P.CREATE, P.REVOKE)
    version = published_version(project)
    file, _ = PublishedFileService.register(
        actor=user, request=request_for(user), version_id=version.pk,
        data=registration(version, root),
    )  # fmt: skip
    stale = PublishedFile.objects.get(pk=file.pk)

    results = run_parallel(
        2,
        lambda i: PublishedFileService.revoke(
            actor=user, request=request_for(user), file=stale, reason=f"reason {i}"
        ),
    )

    outcomes = Counter("ok" if ok else type(value).__name__ for ok, value in results)
    assert outcomes == {"ok": 1, "InvalidTransition": 1}
    assert all(isinstance(v, InvalidTransition) for ok, v in results if not ok)
    stored = PublishedFile.objects.get(pk=file.pk)
    assert stored.status == "Revoked"
    assert PublishedFileEvent.objects.filter(file=file, to_status="Revoked").count() == 1


def test_concurrent_registrations_on_two_roots_do_not_interfere(project):
    user = member(project, P.CREATE)
    version = published_version(project)
    roots = [storage_root("ROOTA"), storage_root("ROOTB")]

    results = run_parallel(
        4,
        lambda i: PublishedFileService.register(
            actor=user,
            request=request_for(user),
            version_id=version.pk,
            data=registration(version, roots[i % 2], sha256=OTHER_SHA),
        ),
    )

    assert Counter(created for ok, (_f, created) in results if ok) == {True: 2, False: 2}
    assert PublishedFile.objects.count() == 2
