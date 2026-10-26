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
    AssetFactory,
    EpisodeFactory,
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
    TaskFactory,
    TimelogFactory,
    VersionFactory,
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
    assert "Assets with a bad parent: 0" in text
    assert "Tasks naming a record they are not linked to: 0" in text
    assert "Versions that block migration 0038: 0" in text


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
    typed = TaskFactory.create(project=project, entity_id="", code="TYPED", logged_hours=40)
    backed = TaskFactory.create(project=project, entity_id="", code="BACKED", logged_hours=6)
    TimelogFactory.create(task=backed, duration_hours=6, status="Approved")
    TaskFactory.create(project=project, entity_id="", code="ZERO")

    text = _report()

    assert "Tasks whose stored hours differ from their approved timelogs: 1" in text
    assert f"task TYPED {typed.pk}: stored 40.00, approved timelogs 0.00" in text
    assert "task BACKED" not in text


def test_the_archive_flag_overlap_is_counted_and_is_not_a_finding():
    project = ProjectFactory.create(code="RPT8")
    TaskFactory.create(project=project, entity_id="", code="NEITHER")
    TaskFactory.create(project=project, entity_id="", code="FLAG", is_archived=True)
    TaskFactory.create(
        project=project, entity_id="", code="BOTH", is_archived=True, is_deleted=True
    )
    TaskFactory.create(project=project, entity_id="", code="GONE", is_deleted=True)
    VersionFactory.create(project=project, code="V-FLAG", is_archived=True)  # how versions archive

    text = _report("--fail-on-findings")  # would exit 1 if the overlap counted as a finding

    assert "Archive flag versus soft delete (information, not findings):" in text
    assert "  Task: flag only 1, deleted only 1, both 1, neither 1" in text
    assert "  Version: flag only 1, deleted only 0, both 0, neither 0" in text
    assert "  Asset: flag only 0, deleted only 0, both 0, neither 0" in text


def test_bad_asset_parents_are_findings_and_catalog_counts_are_information():
    mine, other = ProjectFactory.create(code="RPT9"), ProjectFactory.create(code="RPT10")
    foreign = AssetFactory.create(project=other, code="FOREIGN")
    crossed = AssetFactory.create(project=mine, code="CROSSED", parent_asset=foreign)
    a = AssetFactory.create(project=mine, code="LOOPA")
    b = AssetFactory.create(project=mine, code="LOOPB", parent_asset=a)
    type(a).objects.filter(pk=a.pk).update(parent_asset=b)  # a loop the API would now refuse
    TaskFactory.create(project=mine, entity_id="", code="UNTYPED")

    text = _report()

    assert "Assets with a bad parent: 3" in text
    assert f"asset CROSSED {crossed.pk}: parent is in another project" in text
    assert text.count("parent chain loops back to it") == 2
    assert "  Assets with an asset type: 0 of 4" in text
    assert "  Tasks with a task type: 0 of 1" in text
    with pytest.raises(SystemExit):
        _report("--fail-on-findings")


def test_tasks_naming_a_record_they_are_not_linked_to_are_listed_with_a_reason():
    mine, other = ProjectFactory.create(code="RPT11"), ProjectFactory.create(code="RPT12")
    foreign = ShotFactory.create(project=other, code="F1")
    TaskFactory.create(
        project=mine, code="LINKED", shot=ShotFactory.create(project=mine, code="S1")
    )
    TaskFactory.create(project=mine, code="GENERAL", entity_type="Shot", entity_id="")
    TaskFactory.create(project=mine, code="MOCK", entity_type="Shot", entity_id="mock-3")
    TaskFactory.create(project=mine, code="CROSS", entity_type="Shot", entity_id=str(foreign.id))
    TaskFactory.create(project=mine, code="BANANA", entity_type="Banana", entity_id="x")

    text = _report()

    assert "Tasks naming a record they are not linked to: 3" in text
    assert "no record of that code in the project" in text
    assert "the record belongs to another project" in text
    assert 'unknown entity type "Banana"' in text
    assert "task LINKED" not in text and "task GENERAL" not in text


def test_versions_that_would_block_the_migration_are_findings(without_constraints):
    project = ProjectFactory.create(code="RPT13")
    shot = ShotFactory.create(project=project, code="S1")
    asset = AssetFactory.create(project=project, code="A1")
    # The constraints migration 0039 adds would refuse these rows: take them away for this test only
    # (the fixture's block is rolled back, so they come back).
    with connection.cursor() as cursor:
        cursor.execute(
            "ALTER TABLE production_version DROP CONSTRAINT production_version_one_entity_ck"
        )
        cursor.execute("DROP INDEX production_version_shot_hero_uniq")
    VersionFactory.create(project=project, code="OK", shot=shot, version_index=1)
    VersionFactory.create(project=project, code="BOTH", shot=shot, asset=asset, version_index=2)
    VersionFactory.create(project=project, code="H1", shot=shot, is_hero=True, version_index=3)
    VersionFactory.create(project=project, code="H2", shot=shot, is_hero=True, version_index=4)

    text = _report()

    assert "Versions that block migration 0038: 2" in text
    assert "BOTH" in text and "has both a shot and an asset" in text
    assert "2 live hero versions" in text
    assert "Versions sharing a number within their series (information): 0" in text


def test_review_list_entries_that_cannot_become_rows_are_listed_as_information():
    from apps.production.models import Review, ReviewItem, ReviewParticipant

    project = ProjectFactory.create(code="RPT14")
    Review.objects.create(
        project=project,
        code="RV1",
        title="t",
        versions=[{"id": "junk"}],
        reviewers=["x", {"id": "p1", "name": "ok"}],
        comments=[5],
    )

    text = _report()

    assert "Review list entries migration 0041 cannot convert (information): 3" in text
    assert "review RV1: versions[0] matches no version of the project" in text
    assert "review RV1: reviewers[0] is not an object" in text
    assert not ReviewItem.objects.exists() and not ReviewParticipant.objects.exists()  # a dry run


def test_playlist_entries_that_cannot_become_rows_are_listed_as_information():
    from apps.production.models import Playlist, PlaylistEntry

    project = ProjectFactory.create(code="RPT15")
    Playlist.objects.create(
        project=project,
        code="PLX",
        name="n",
        entries=[{"version_id": "00000000-0000-0000-0000-000000000001"}, "x", {"label": "ok"}],
    )

    text = _report()

    assert "Playlist entries migration 0043 cannot convert (information): 2" in text
    assert "playlist PLX: entries[0] names no version of the project" in text
    assert not PlaylistEntry.objects.exists()  # a dry run


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
