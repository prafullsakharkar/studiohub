"""
``report_production_data`` is read-only and lists what the hierarchy constraints would
reject (case-variant codes, backwards frame ranges) or leave unresolved (shots naming no
sequence). The constraints now stop the first two from being written, so those tests drop
them inside a transaction that is rolled back.
"""

from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command
from django.db import connection, transaction

from apps.production.models import Shot
from apps.production.tests.factories import (
    EpisodeFactory,
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
    TaskFactory,
    TimelogFactory,
)

pytestmark = pytest.mark.django_db(transaction=True)


def _report(*args):
    out = StringIO()
    call_command("report_production_data", *args, stdout=out)
    return out.getvalue()


@pytest.fixture
def without_constraints():
    """Drop the constraints for the length of the test; the rollback puts them back."""
    with pytest.raises(_Rollback), transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute(
                "ALTER TABLE production_shot DROP CONSTRAINT production_shot_frame_range_ck"
            )
            cursor.execute("DROP INDEX production_shot_project_ucode_uniq")
        yield
        raise _Rollback


class _Rollback(Exception):
    pass


def test_a_clean_database_reports_nothing_and_passes_the_gate():
    project = ProjectFactory.create(code="RPT1")
    sequence = SequenceFactory.create(project=project, code="SQ1")
    ShotFactory.create(project=project, code="S1", sequence=sequence)

    text = _report("--fail-on-findings")

    assert "Codes that differ only by case: 0" in text
    assert "Frame ranges running backwards: 0" in text
    assert "Shots naming no sequence of their project: 0" in text
    assert "Sequences of episodic projects without an episode: 0" in text
    assert "Shots whose episode differs from their sequence's: 0" in text
    assert "Tasks whose stored hours differ from their approved timelogs: 0" in text


def test_shots_naming_no_sequence_are_listed_and_fail_the_gate():
    project = ProjectFactory.create(code="RPT2")
    SequenceFactory.create(project=project, code="SQ1")
    ShotFactory.create(project=project, code="S1", sequence_code="SQX")
    ShotFactory.create(
        project=project, code="S2", sequence_code="sq1"
    )  # case-insensitive match: found

    text = _report()
    assert "Shots naming no sequence of their project: 1 shot(s) in 1 group(s)" in text
    assert "sequence_code='SQX'" in text
    with pytest.raises(SystemExit) as stop:
        _report("--fail-on-findings")
    assert stop.value.code == 1


def test_episode_gaps_and_mismatches_are_listed():
    show = ProjectFactory.create(code="RPT5", workflow_type="episodic")
    flat = ProjectFactory.create(code="RPT6", workflow_type="standard")
    ep1 = EpisodeFactory.create(project=show, code="EP1")
    ep2 = EpisodeFactory.create(project=show, code="EP2")
    SequenceFactory.create(project=show, code="NOSHOTS")
    SequenceFactory.create(project=flat, code="STANDARD")  # standard projects have no episodes
    split = SequenceFactory.create(project=show, code="SPLIT")
    ShotFactory.create(project=show, code="S1", sequence=split, episode=ep1)
    ShotFactory.create(project=show, code="S2", sequence=split, episode=ep2)
    filed = SequenceFactory.create(project=show, code="FILED", episode=ep1)
    ShotFactory.create(project=show, code="OK", sequence=filed, episode=ep1)
    ShotFactory.create(project=show, code="ASTRAY", sequence=filed, episode=ep2)
    ShotFactory.create(project=show, code="NOEP", sequence=filed, episode=None)

    text = _report()

    assert "Sequences of episodic projects without an episode: 2" in text
    assert "no shots to take an episode from" in text
    assert "its shots do not share one episode" in text
    assert "Shots whose episode differs from their sequence's: 2" in text
    assert "shot ASTRAY" in text and "shot NOEP" in text and "shot OK" not in text


def test_stored_hours_that_no_approved_timelog_backs_are_listed():
    project = ProjectFactory.create(code="RPT7")
    typed = TaskFactory.create(project=project, code="TYPED", logged_hours=40)
    backed = TaskFactory.create(project=project, code="BACKED", logged_hours=6)
    TimelogFactory.create(task=backed, duration_hours=6, status="Approved")
    TaskFactory.create(project=project, code="ZERO")

    text = _report()

    assert "Tasks whose stored hours differ from their approved timelogs: 1" in text
    assert f"task TYPED {typed.pk}: stored 40.00, approved timelogs 0.00" in text
    assert "task BACKED" not in text


def test_it_changes_nothing():
    project = ProjectFactory.create(code="RPT3")
    ShotFactory.create(project=project, code="S1", sequence_code="SQX")
    before = list(Shot.all_objects.values_list("pk", "sequence_id", "sequence_code"))

    _report()

    assert list(Shot.all_objects.values_list("pk", "sequence_id", "sequence_code")) == before


def test_case_variant_codes_and_backwards_ranges_are_found(without_constraints):
    project = ProjectFactory.create(code="RPT4")
    ShotFactory.create(project=project, code="SH010")
    ShotFactory.create(project=project, code="sh010")
    ShotFactory.create(project=project, code="SH020", frame_in=100, frame_out=50)
    ShotFactory.create(project=project, code="SH030", is_deleted=True)  # soft-deleted rows count
    ShotFactory.create(project=project, code="sh030")

    text = _report()

    assert "Codes that differ only by case: 2 group(s)" in text
    assert "Frame ranges running backwards: 1" in text
    assert "100 -> 50" in text
