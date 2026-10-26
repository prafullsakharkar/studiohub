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
from apps.production.tests.factories import ProjectFactory, SequenceFactory, ShotFactory

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
