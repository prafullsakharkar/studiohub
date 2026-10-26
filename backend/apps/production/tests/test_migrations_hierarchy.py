"""
Migrations 0025 (code and frame constraints), 0026 (Shot.sequence) and 0027 (fill it).

0025 refuses, loudly and without changing anything, rows the new constraints would
reject. 0027 links shots to the sequence their old text names (any case, soft-deleted
sequences included) and leaves the rest unlinked with their text intact (D-11).
Each test restores the database to the latest migration, even when it fails.
"""

from __future__ import annotations

import uuid

import pytest
from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

pytestmark = pytest.mark.django_db(transaction=True)

BEFORE_CONSTRAINTS = [("production", "0024_status_override_and_timelog_adjustment")]
WITH_CONSTRAINTS = [("production", "0025_code_and_frame_constraints")]
WITH_COLUMN = [("production", "0026_shot_sequence")]
WITH_EPISODE_COLUMN = [("production", "0028_sequence_episode")]
BEFORE_ARCHIVE_RECONCILE = [("production", "0030_protect_history_rows")]
BEFORE_ASSET_TYPES = [("production", "0033_task_types_and_templates")]
BEFORE_TASK_LINKS = [("production", "0035_task_entity_links")]
BEFORE_VERSION_PREP = [("production", "0037_version_published_by")]


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


class TestSequencesAreFiledUnderTheirShotsEpisode:
    def test_only_an_unambiguous_episodic_sequence_is_filled(self, restore):
        apps = _migrate(WITH_EPISODE_COLUMN)
        Project = apps.get_model("production", "Project")
        Episode = apps.get_model("production", "Episode")
        Sequence = apps.get_model("production", "Sequence")
        Shot = apps.get_model("production", "Shot")
        show = Project.objects.create(code="EPA", name="a", workflow_type="episodic")
        flat = Project.objects.create(code="EPB", name="b", workflow_type="standard")
        ep1 = Episode.objects.create(
            project=show, code="EP1", name="1", season_number=1, episode_number=1
        )
        ep2 = Episode.objects.create(
            project=show, code="EP2", name="2", season_number=1, episode_number=2
        )
        flat_ep = Episode.objects.create(
            project=flat, code="EPF", name="f", season_number=1, episode_number=1
        )
        agree = Sequence.objects.create(project=show, code="AGREE", name="a")
        split = Sequence.objects.create(project=show, code="SPLIT", name="s")
        gap = Sequence.objects.create(project=show, code="GAP", name="g")
        empty = Sequence.objects.create(project=show, code="EMPTY", name="e")
        plain = Sequence.objects.create(project=flat, code="PLAIN", name="p")
        hidden = Sequence.objects.create(project=show, code="HIDDEN", name="h")
        for code, sequence, episode, project, deleted in (
            ("A1", agree, ep1, show, False),
            ("A2", agree, ep1, show, False),
            ("S1", split, ep1, show, False),
            ("S2", split, ep2, show, False),
            ("G1", gap, ep1, show, False),
            ("G2", gap, None, show, False),
            ("P1", plain, flat_ep, flat, False),
            ("H1", hidden, ep1, show, False),
            ("H2", hidden, ep2, show, True),  # a soft-deleted shot still counts
        ):
            Shot.objects.create(
                project=project,
                code=code,
                name=code,
                sequence=sequence,
                episode=episode,
                is_deleted=deleted,
            )

        apps = _migrate(_latest())

        filled = {
            s.code: s.episode.code if s.episode_id else None
            for s in apps.get_model("production", "Sequence").objects.select_related("episode")
        }
        assert filled == {
            "AGREE": "EP1",
            "SPLIT": None,
            "GAP": None,
            "EMPTY": None,
            "PLAIN": None,  # standard project
            "HIDDEN": None,
        }
        assert empty.pk
        shots = apps.get_model("production", "Shot").objects
        assert shots.get(code="G2").episode_id is None  # shots are never touched


class TestArchiveFlagReconciled:
    """0031: rows that only carry the old flag are soft-deleted; everything else is left alone."""

    def _make(self, apps, project, name, code, **extra):
        model = apps.get_model("production", name)
        fields = {"project": project, "code": code, **extra}
        if name in ("Asset", "Playlist", "Workflow"):
            fields.setdefault("name", code)
        if name == "Task":
            fields.setdefault("title", code)
        return model.objects.create(**fields)

    def test_only_flag_only_rows_are_soft_deleted(self, restore):
        apps = _migrate(BEFORE_ARCHIVE_RECONCILE)
        project = _project(apps, "ARCM")
        made = {}
        for name in ("Task", "Asset", "Version", "Playlist", "Workflow"):
            made[name] = {
                "flag_only": self._make(apps, project, name, f"{name[:3]}-F", is_archived=True),
                "both": self._make(
                    apps, project, name, f"{name[:3]}-B", is_archived=True, is_deleted=True
                ),
                "deleted_only": self._make(apps, project, name, f"{name[:3]}-D", is_deleted=True),
                "neither": self._make(apps, project, name, f"{name[:3]}-N"),
            }

        apps = _migrate(_latest())

        for name, rows in made.items():
            model = apps.get_model("production", name)
            state = {key: model._base_manager.get(pk=row.pk) for key, row in rows.items()}
            assert (
                state["flag_only"].is_deleted is True and state["flag_only"].deleted_at is not None
            ), name
            assert state["flag_only"].is_archived is True  # the column itself is not touched
            assert (
                state["both"].is_deleted,
                state["deleted_only"].is_deleted,
                state["neither"].is_deleted,
            ) == (
                True,
                True,
                False,
            ), name

    def test_running_it_again_changes_nothing(self, restore):
        apps = _migrate(BEFORE_ARCHIVE_RECONCILE)
        project = _project(apps, "ARCN")
        self._make(apps, project, "Task", "T-F", is_archived=True)
        apps = _migrate(_latest())
        first = apps.get_model("production", "Task")._base_manager.get(code="T-F").deleted_at

        _migrate(BEFORE_ARCHIVE_RECONCILE)  # reverse does nothing
        apps = _migrate(_latest())

        assert (
            apps.get_model("production", "Task")._base_manager.get(code="T-F").deleted_at == first
        )


class TestAssetTypesLinked:
    """0034: an asset takes the catalog type its category names, only when exactly one entry matches."""

    def test_unique_matches_by_code_or_name_are_linked_and_the_rest_left_alone(self, restore):
        apps = _migrate(BEFORE_ASSET_TYPES)
        project = _project(apps, "ATY")
        Catalog = apps.get_model("masterdata", "MasterAssetType")
        by_code = Catalog.objects.create(code="PROP", name="Practical prop")
        by_name = Catalog.objects.create(code="CHR", name="Character")
        Catalog.objects.create(code="VEHICLE", name="Car")
        Catalog.objects.create(
            code="V2", name="Vehicle"
        )  # "Vehicle" now names two entries: ambiguous
        Catalog.objects.create(
            code="ENV", name="Set", is_deleted=True
        )  # archived entries do not count
        Asset = apps.get_model("production", "Asset")
        made = {
            category: Asset.objects.create(
                project=project, code=f"A-{n}", name="a", category=category
            )
            for n, category in enumerate(
                ("Prop", "Character", "Vehicle", "Environment", "Matte Painting")
            )
        }

        apps = _migrate(_latest())

        Asset = apps.get_model("production", "Asset")
        linked = {
            category: Asset.objects.get(pk=row.pk).asset_type_id for category, row in made.items()
        }
        assert linked == {
            "Prop": by_code.pk,
            "Character": by_name.pk,
            "Vehicle": None,  # ambiguous
            "Environment": None,  # only an archived entry
            "Matte Painting": None,  # no entry
        }
        assert (
            Asset.objects.get(pk=made["Prop"].pk).category == "Prop"
        )  # the category itself is untouched


class TestTaskEntitiesLinked:
    """0036: a task is linked only to a record it provably names, in its own project."""

    def test_what_is_provable_is_linked_and_the_rest_left_alone(self, restore):
        apps = _migrate(BEFORE_TASK_LINKS)
        project, other = _project(apps, "TLA"), _project(apps, "TLB")
        Shot, Asset, Sequence = (
            apps.get_model("production", name) for name in ("Shot", "Asset", "Sequence")
        )
        Task = apps.get_model("production", "Task")
        shot = Shot.objects.create(project=project, code="SH010", name="a")
        archived = Shot.objects.create(project=project, code="OLD", name="o", is_deleted=True)
        foreign = Shot.objects.create(project=other, code="SH010", name="f")
        asset = Asset.objects.create(project=project, code="ROCK", name="r")
        sequence = Sequence.objects.create(project=project, code="SQ1", name="s")
        Shot.objects.create(project=project, code="SH020", name="b")

        def task(code, **fields):
            fields.setdefault("project", project)
            return Task.objects.create(code=code, title=code, **fields)

        made = {
            "uuid": task("UUID", entity_type="Shot", entity_id=str(shot.id)),
            "archived": task("ARCH", entity_type="Shot", entity_id=str(archived.id)),
            "asset_uuid": task("ASSET", entity_type="Asset", entity_id=str(asset.id)),
            "sequence": task("SEQ", entity_type="sequence", entity_id=str(sequence.id)),
            "code": task("CODE", entity_type="Shot", entity_id="sh010"),
            "code_in_text": task(
                "CODETXT", entity_type="Shot", entity_id="mock-1", entity_code="SH020"
            ),
            "foreign": task("FOREIGN", entity_type="Shot", entity_id=str(foreign.id)),
            "missing": task("MISSING", entity_type="Shot", entity_id=str(uuid.uuid4())),
            "no_code": task("NOCODE", entity_type="Shot", entity_id="NOPE"),
            "two": task("TWO", entity_type="Shot", entity_id="SH010", entity_code="SH020"),
            "wrong_kind": task("KIND", entity_type="Asset", entity_id=str(shot.id)),
            "unknown_type": task("TYPE", entity_type="Banana", entity_id="SH010"),
            "general": task("GEN", entity_type="General", entity_id=""),
            "no_project": task("NOPROJ", entity_type="Shot", entity_id=str(shot.id), project=None),
        }

        apps = _migrate(_latest())

        Task = apps.get_model("production", "Task")
        state = {
            key: tuple(
                str(value) if value is not None else None
                for value in (row.shot_id, row.asset_id, row.sequence_id)
            )
            for key, row in ((k, Task._base_manager.get(pk=v.pk)) for k, v in made.items())
        }
        none = (None, None, None)
        assert state == {
            "uuid": (str(shot.id), None, None),
            "archived": (str(archived.id), None, None),
            "asset_uuid": (None, str(asset.id), None),
            "sequence": (None, None, str(sequence.id)),
            "code": (str(shot.id), None, None),
            "code_in_text": (str(Shot.objects.get(code="SH020").id), None, None),
            "foreign": none,
            "missing": none,
            "no_code": none,
            "two": none,  # the id and the code name different records: not guessed
            "wrong_kind": none,
            "unknown_type": none,
            "general": none,
            "no_project": none,
        }
        assert Task._base_manager.get(pk=made["foreign"].pk).entity_id == str(
            foreign.id
        )  # the text is untouched


class TestVersionsPrepared:
    """0038 refuses what 0039's constraints would reject and prepares the rest."""

    def _models(self, apps):
        return {n: apps.get_model("production", n) for n in ("Version", "Shot", "Asset", "Task")}

    def _version(self, apps, project, code, **fields):
        return apps.get_model("production", "Version").objects.create(
            project=project, code=code, **fields
        )

    def test_numbers_are_made_unique_within_each_series_without_rewriting_the_text(self, restore):
        apps = _migrate(BEFORE_VERSION_PREP)
        project = _project(apps, "VPA")
        m = self._models(apps)
        shot = m["Shot"].objects.create(project=project, code="S1", name="s")
        other = m["Shot"].objects.create(project=project, code="S2", name="s")
        task = m["Task"].objects.create(project=project, code="T1", title="t")
        made = {}
        for key, number in (
            ("a", "v001"),
            ("b", "v002"),
            ("dup", "v002"),
            ("final", "final"),
            ("gap", "v010"),
        ):
            made[key] = self._version(apps, project, f"T-{key}", task=task, version_number=number)
        shot_a = self._version(apps, project, "S-a", shot=shot, version_number="V003")
        shot_b = self._version(apps, project, "S-b", shot=shot, version_number="v003")
        elsewhere = self._version(apps, project, "S2-a", shot=other, version_number="v001")
        loose = self._version(apps, project, "LOOSE", version_number="v007", version_index=5)

        apps = _migrate(_latest())

        Version = apps.get_model("production", "Version")
        index = {key: Version.objects.get(pk=row.pk).version_index for key, row in made.items()}
        assert index == {
            "a": 1,
            "b": 2,
            "gap": 10,
            "dup": 11,
            "final": 12,
        }  # leftovers follow, in creation order
        assert sorted(
            Version.objects.filter(shot_id=shot.pk).values_list("version_index", flat=True)
        ) == [3, 4]
        assert Version.objects.get(pk=elsewhere.pk).version_index == 1
        assert Version.objects.get(pk=loose.pk).version_index == 5  # linked to nothing: untouched
        assert (
            Version.objects.get(pk=made["dup"].pk).version_number == "v002"
        )  # the text is never rewritten
        assert shot_a.pk and shot_b.pk

    def test_a_missing_project_is_filled_from_the_records_and_published_at_is_backfilled(
        self, restore
    ):
        apps = _migrate(BEFORE_VERSION_PREP)
        project = _project(apps, "VPB")
        m = self._models(apps)
        shot = m["Shot"].objects.create(project=project, code="S1", name="s")
        task = m["Task"].objects.create(project=project, code="T1", title="t")
        by_shot = self._version(apps, None, "BY-SHOT", shot=shot)
        by_task = self._version(apps, None, "BY-TASK", task=task, version_number="v002")
        good = self._version(
            apps, project, "PUB1", shot=shot, version_number="v003", is_published=True,
            publishing_info={"published_at": "2026-03-04T05:06:07Z"},
        )  # fmt: skip
        bad = self._version(
            apps, project, "PUB2", shot=shot, version_number="v004", is_published=True,
            publishing_info={"published_at": "yesterday"},
        )  # fmt: skip

        apps = _migrate(_latest())

        Version = apps.get_model("production", "Version")
        assert Version.objects.get(pk=by_shot.pk).project_id == project.pk
        assert Version.objects.get(pk=by_task.pk).project_id == project.pk
        assert (
            Version.objects.get(pk=good.pk)
            .published_at.isoformat()
            .startswith("2026-03-04T05:06:07")
        )
        assert Version.objects.get(pk=bad.pk).published_at is None

    @pytest.mark.parametrize(
        ("case", "message"),
        [
            ("both", "both a shot and an asset"),
            ("heroes", "2 live hero versions"),
            ("orphan", "no project"),
        ],
    )
    def test_what_cannot_be_fixed_stops_the_migration_and_changes_nothing(
        self, restore, case, message
    ):
        apps = _migrate(BEFORE_VERSION_PREP)
        project = _project(apps, "VPC")
        m = self._models(apps)
        shot = m["Shot"].objects.create(project=project, code="S1", name="s")
        asset = m["Asset"].objects.create(project=project, code="A1", name="a")
        probe = self._version(apps, project, "PROBE", shot=shot, version_number="v002")
        if case == "both":
            self._version(apps, project, "BAD", shot=shot, asset=asset)
        elif case == "heroes":
            self._version(apps, project, "H1", shot=shot, is_hero=True)
            self._version(apps, project, "H2", shot=shot, is_hero=True)
        else:
            self._version(apps, None, "LOST")

        with pytest.raises(RuntimeError, match=message):
            _migrate(_latest())

        Version = apps.get_model("production", "Version")
        assert Version.objects.get(pk=probe.pk).version_index == 1  # nothing was prepared

    def test_archived_heroes_do_not_count(self, restore):
        apps = _migrate(BEFORE_VERSION_PREP)
        project = _project(apps, "VPD")
        shot = self._models(apps)["Shot"].objects.create(project=project, code="S1", name="s")
        self._version(apps, project, "H1", shot=shot, is_hero=True)
        self._version(apps, project, "H2", shot=shot, is_hero=True, is_deleted=True)

        apps = _migrate(_latest())

        assert apps.get_model("production", "Version")._base_manager.count() == 2
