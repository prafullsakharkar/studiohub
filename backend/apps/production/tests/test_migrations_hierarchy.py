"""
Migrations 0025 (code and frame constraints), 0026 (Shot.sequence) and 0027 (fill it).

0025 refuses, loudly and without changing anything, rows the new constraints would
reject. 0027 links shots to the sequence their old text names (any case, soft-deleted
sequences included) and leaves the rest unlinked with their text intact (D-11).
Each test restores the database to the latest migration, even when it fails.
"""

from __future__ import annotations

import pytest
from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

pytestmark = pytest.mark.django_db(transaction=True)

BEFORE_CONSTRAINTS = [("production", "0024_status_override_and_timelog_adjustment")]
WITH_CONSTRAINTS = [("production", "0025_code_and_frame_constraints")]
WITH_COLUMN = [("production", "0026_shot_sequence")]


def _latest():
    return MigrationExecutor(connection).loader.graph.leaf_nodes("production")


def _migrate(targets):
    executor = MigrationExecutor(connection)
    executor.migrate(targets)
    executor = MigrationExecutor(connection)
    return executor.loader.project_state(targets).apps


@pytest.fixture
def restore():
    latest = _latest()
    yield
    # Rows a test left behind may be exactly what 0025 refuses; clear them first.
    call_command("flush", interactive=False, verbosity=0, inhibit_post_migrate=True)
    _migrate(latest)


def _project(apps, code="MIG"):
    return apps.get_model("production", "Project").objects.create(code=code, name=code)


class TestConstraintsRefuseBadRows:
    def test_case_variant_codes_stop_the_migration_and_nothing_is_changed(self, restore):
        apps = _migrate(BEFORE_CONSTRAINTS)
        project = _project(apps)
        Shot = apps.get_model("production", "Shot")
        Shot.objects.create(project=project, code="SH010", name="a")
        Shot.objects.create(project=project, code="sh010", name="b")

        with pytest.raises(RuntimeError, match="SH010|sh010"):
            _migrate(WITH_CONSTRAINTS)

        assert Shot.objects.filter(project=project).count() == 2  # untouched

    def test_soft_deleted_rows_count(self, restore):
        apps = _migrate(BEFORE_CONSTRAINTS)
        project = _project(apps)
        Sequence = apps.get_model("production", "Sequence")
        Sequence.objects.create(project=project, code="SQ1", name="a")
        Sequence.objects.create(project=project, code="sq1", name="b", is_deleted=True)

        with pytest.raises(RuntimeError, match="Sequence"):
            _migrate(WITH_CONSTRAINTS)

    def test_a_backwards_frame_range_stops_the_migration(self, restore):
        apps = _migrate(BEFORE_CONSTRAINTS)
        project = _project(apps)
        apps.get_model("production", "Shot").objects.create(
            project=project, code="S1", name="a", frame_in=100, frame_out=50
        )

        with pytest.raises(RuntimeError, match="frame_out < frame_in"):
            _migrate(WITH_CONSTRAINTS)

    def test_clean_data_migrates_and_the_constraint_then_holds(self, restore):
        apps = _migrate(BEFORE_CONSTRAINTS)
        project = _project(apps)
        Shot = apps.get_model("production", "Shot")
        Shot.objects.create(project=project, code="SH010", name="a")
        Shot.objects.create(project=project, code="SH020", name="b")

        apps = _migrate(WITH_CONSTRAINTS)

        from django.db import IntegrityError, transaction

        with pytest.raises(IntegrityError, match="ucode_uniq"), transaction.atomic():
            apps.get_model("production", "Shot").objects.create(
                project=apps.get_model("production", "Project").objects.get(code="MIG"),
                code="sh010",
                name="c",
            )


class TestShotsAreLinkedToTheirSequence:
    def test_mapping_and_the_ambiguous_and_unmatched_cases(self, restore):
        apps = _migrate(WITH_COLUMN)
        project = _project(apps, "MAPA")
        other = _project(apps, "MAPB")
        Sequence = apps.get_model("production", "Sequence")
        Shot = apps.get_model("production", "Shot")
        live = Sequence.objects.create(project=project, code="SQ010", name="live")
        Sequence.objects.create(project=project, code="Sq020", name="mixed case")
        archived = Sequence.objects.create(
            project=project, code="SQDEL", name="archived", is_deleted=True
        )
        for code, text, owner in (
            ("S1", "SQ010", project),
            ("S2", "sq010", project),  # case differs
            ("S3", "SQ020", project),  # sequence stored as Sq020
            ("S4", "SQDEL", project),  # soft-deleted sequence still owns the text
            ("S5", "SQX", project),  # matches nothing
            (
                "S6",
                "SQ010",
                other,
            ),  # right text, wrong project: the other project has no such sequence
            ("S7", "", project),  # no sequence at all
        ):
            Shot.objects.create(project=owner, code=code, name=code, sequence_code=text)

        apps = _migrate(_latest())

        Shot = apps.get_model("production", "Shot")
        rows = {
            s.code: (s.sequence.code if s.sequence_id else None, s.sequence_code)
            for s in Shot.objects.select_related("sequence")
        }
        assert rows == {
            "S1": ("SQ010", "SQ010"),
            "S2": ("SQ010", "SQ010"),
            "S3": ("Sq020", "Sq020"),
            "S4": ("SQDEL", "SQDEL"),
            "S5": (None, "SQX"),
            "S6": (None, "SQ010"),
            "S7": (None, ""),
        }
        assert live.pk and archived.pk

    def test_it_can_run_twice_and_is_reversible(self, restore):
        apps = _migrate(WITH_COLUMN)
        project = _project(apps)
        apps.get_model("production", "Sequence").objects.create(
            project=project, code="SQ1", name="a"
        )
        apps.get_model("production", "Shot").objects.create(
            project=project, code="S1", name="a", sequence_code="sq1"
        )

        _migrate(_latest())
        apps = _migrate(WITH_COLUMN)  # back to before the fill: the text is still there
        assert apps.get_model("production", "Shot").objects.get(code="S1").sequence_code == "SQ1"
        apps = _migrate(_latest())  # forward again
        assert apps.get_model("production", "Shot").objects.get(code="S1").sequence_id is not None
