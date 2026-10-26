"""
Read-only report of production data that the hierarchy constraints would reject or
leave unresolved. Run it before migrating a shared database, and after, to see what
is left:

    uv run python manage.py report_production_data [--fail-on-findings]

* codes that collide when case is ignored (per project, per entity; soft-deleted rows count)
* frame ranges that run backwards
* shots whose ``sequence_code`` names no sequence of their project (they keep
  ``sequence = NULL`` after migration; see DECISIONS D-11)
* sequences of episodic projects that have no episode, and why (their shots span several
  episodes, or they have none), and shots whose episode differs from their sequence's
  (DECISIONS D-12)
* how the legacy ``is_archived`` flag and the soft delete overlap on the five models that have
  both (information only, not a finding). "Flag only" is what migration 0031 soft-deletes, so
  run this before migrating; after it, 0 is expected (DECISIONS D-25)
* assets whose parent is in another project, or whose parent chain loops back to them (the API
  now refuses both; DECISIONS D-27), and, as information, how many assets have a catalog type and
  how many tasks have a task type
* tasks whose old stored ``logged_hours`` differs from the sum of their approved timelogs:
  responses now show the sum, so a hand-typed number stops appearing (DECISIONS D-15)

Nothing is changed. It reads the database selected by ``DJANGO_ENV``.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import models
from django.db.models import Count, Q

from apps.production.constants import ProjectWorkflowType
from apps.production.models import Asset, Episode, Playlist, Sequence, Shot, Task, Version, Workflow
from apps.production.selectors.rollups import TaskHoursSelector

CODED = (Episode, Sequence, Shot, Asset, Task, Version)
FRAME_RANGES = (
    (Episode, "frame_in", "frame_out"),
    (Sequence, "frame_in", "frame_out"),
    (Shot, "frame_in", "frame_out"),
    (Version, "start_frame", "end_frame"),
)


def case_variant_codes():
    """``[(model name, project id, [codes], [ids])]`` for codes used more than once, any case."""
    found = []
    for model in CODED:
        groups: dict[tuple[object, str], list[tuple[str, str]]] = {}
        for pk, project_id, code in model.all_objects.values_list(
            "pk", "project_id", "code"
        ).iterator():
            groups.setdefault((project_id, (code or "").upper()), []).append((str(pk), code))
        for (project_id, _), rows in groups.items():
            if len(rows) > 1:
                found.append(
                    (model.__name__, project_id, sorted({c for _, c in rows}), [i for i, _ in rows])
                )
    return found


def backwards_frame_ranges():
    found = []
    for model, low, high in FRAME_RANGES:
        for pk, a, b in model.all_objects.values_list("pk", low, high).iterator():
            if a is not None and b is not None and b < a:
                found.append((model.__name__, str(pk), a, b))
    return found


def unmatched_shot_sequences():
    """``{(project id, sequence_code): [shot ids]}`` for shots naming no sequence of their project."""
    known = {
        (project_id, (code or "").upper())
        for project_id, code in Sequence.all_objects.values_list("project_id", "code")
    }
    unmatched: dict[tuple[object, str], list[str]] = {}
    for pk, project_id, code in Shot.all_objects.exclude(sequence_code="").values_list(
        "pk", "project_id", "sequence_code"
    ):
        if (project_id, code.upper()) not in known:
            unmatched.setdefault((project_id, code), []).append(str(pk))
    return unmatched


def sequences_without_episode():
    """``[(sequence id, project id, code, reason)]`` for sequences of episodic projects with no episode."""
    found = []
    candidates = Sequence.all_objects.filter(
        episode__isnull=True, project__workflow_type=ProjectWorkflowType.EPISODIC
    )
    for pk, project_id, code in candidates.values_list("pk", "project_id", "code"):
        episodes = set(Shot.all_objects.filter(sequence_id=pk).values_list("episode_id", flat=True))
        if not episodes:
            reason = "no shots to take an episode from"
        elif len(episodes) > 1 or None in episodes:
            reason = "its shots do not share one episode"
        else:
            reason = "its shots agree on one episode but it was not filled in"
        found.append((str(pk), project_id, code, reason))
    return found


def shots_out_of_step_with_sequence():
    """``[(shot id, shot code, sequence code)]`` for shots whose episode differs from their sequence's."""
    rows = (
        Shot.all_objects.filter(sequence__isnull=False, sequence__episode__isnull=False)
        .exclude(episode_id=models.F("sequence__episode_id"))
        .values_list("pk", "code", "sequence__code")
    )
    return [(str(pk), code, sequence_code) for pk, code, sequence_code in rows]


ARCHIVE_FLAG_MODELS = (Task, Asset, Version, Playlist, Workflow)


def archive_flag_overlap():
    """``[(model name, flag only, deleted only, both, neither)]`` for the models with both markers."""
    rows = []
    for model in ARCHIVE_FLAG_MODELS:
        counts = model.all_objects.aggregate(
            flag_only=Count("pk", filter=Q(is_archived=True, is_deleted=False)),
            deleted_only=Count("pk", filter=Q(is_archived=False, is_deleted=True)),
            both=Count("pk", filter=Q(is_archived=True, is_deleted=True)),
            neither=Count("pk", filter=Q(is_archived=False, is_deleted=False)),
        )
        rows.append(
            (
                model.__name__,
                counts["flag_only"],
                counts["deleted_only"],
                counts["both"],
                counts["neither"],
            )
        )
    return rows


def bad_asset_parents():
    """``[(asset id, code, problem)]`` for a parent in another project or a chain that loops."""
    found = []
    parents = dict(
        Asset.all_objects.filter(parent_asset__isnull=False).values_list("pk", "parent_asset_id")
    )
    projects = dict(Asset.all_objects.values_list("pk", "project_id"))
    codes = dict(Asset.all_objects.values_list("pk", "code"))
    for pk, parent_id in parents.items():
        if projects.get(parent_id) != projects.get(pk):
            found.append((str(pk), codes[pk], "parent is in another project"))
            continue
        node, steps = parent_id, 0
        while node is not None and steps < 100:
            if node == pk:
                found.append((str(pk), codes[pk], "parent chain loops back to it"))
                break
            node = parents.get(node)
            steps += 1
    return found


def typing_counts():
    """``(typed assets, all assets, typed tasks, all tasks)``, soft-deleted rows excluded."""
    assets, tasks = Asset.objects.all(), Task.objects.all()
    return (
        assets.filter(asset_type__isnull=False).count(),
        assets.count(),
        tasks.filter(task_type__isnull=False).count(),
        tasks.count(),
    )


def tasks_with_unbacked_hours():
    """``[(task id, code, stored hours, approved timelog hours)]`` where the old stored number differs."""
    rows = TaskHoursSelector.annotate(Task.all_objects.exclude(logged_hours=0))
    return [
        (str(task.pk), task.code, task.logged_hours, task.logged_hours_annotated)
        for task in rows.iterator()
        if task.logged_hours != task.logged_hours_annotated
    ]


class Command(BaseCommand):
    help = "Read-only report of production data the hierarchy constraints would reject or leave unresolved."

    def add_arguments(self, parser):
        parser.add_argument(
            "--fail-on-findings",
            action="store_true",
            help="exit with status 1 when anything is listed",
        )

    def handle(self, *args, **options):
        findings = 0

        duplicates = case_variant_codes()
        self.stdout.write(f"Codes that differ only by case: {len(duplicates)} group(s)")
        for name, project_id, codes, ids in duplicates:
            findings += 1
            self.stdout.write(f"  {name} project={project_id} codes={codes} ids={ids[:5]}")

        ranges = backwards_frame_ranges()
        self.stdout.write(f"Frame ranges running backwards: {len(ranges)}")
        for name, pk, low, high in ranges[:50]:
            findings += 1
            self.stdout.write(f"  {name} {pk}: {low} -> {high}")

        unmatched = unmatched_shot_sequences()
        total = sum(len(ids) for ids in unmatched.values())
        self.stdout.write(
            f"Shots naming no sequence of their project: {total} shot(s) in {len(unmatched)} group(s)"
        )
        for (project_id, code), ids in sorted(
            unmatched.items(), key=lambda item: (str(item[0][0]), item[0][1])
        ):
            findings += 1
            self.stdout.write(
                f"  project={project_id} sequence_code={code!r}: {len(ids)} shot(s), e.g. {ids[:3]}"
            )

        bare = sequences_without_episode()
        self.stdout.write(f"Sequences of episodic projects without an episode: {len(bare)}")
        for pk, project_id, code, reason in bare[:50]:
            findings += 1
            self.stdout.write(f"  {code} {pk} project={project_id}: {reason}")

        stray = shots_out_of_step_with_sequence()
        self.stdout.write(f"Shots whose episode differs from their sequence's: {len(stray)}")
        for pk, code, sequence_code in stray[:50]:
            findings += 1
            self.stdout.write(f"  shot {code} {pk} (sequence {sequence_code})")

        parents = bad_asset_parents()
        self.stdout.write(f"Assets with a bad parent: {len(parents)}")
        for pk, code, problem in parents[:50]:
            findings += 1
            self.stdout.write(f"  asset {code} {pk}: {problem}")

        typed_assets, all_assets, typed_tasks, all_tasks = typing_counts()
        self.stdout.write("Catalog types (information, not findings):")
        self.stdout.write(f"  Assets with an asset type: {typed_assets} of {all_assets}")
        self.stdout.write(f"  Tasks with a task type: {typed_tasks} of {all_tasks}")

        unbacked = tasks_with_unbacked_hours()
        self.stdout.write(
            f"Tasks whose stored hours differ from their approved timelogs: {len(unbacked)}"
        )
        for pk, code, stored, approved in unbacked[:50]:
            findings += 1
            self.stdout.write(f"  task {code} {pk}: stored {stored}, approved timelogs {approved}")

        self.stdout.write("Archive flag versus soft delete (information, not findings):")
        self.stdout.write(
            "  (flag only = rows migration 0031 soft-deletes; 0 is expected after it)"
        )
        for name, flag_only, deleted_only, both, neither in archive_flag_overlap():
            self.stdout.write(
                f"  {name}: flag only {flag_only}, deleted only {deleted_only}, both {both}, neither {neither}"
            )

        self.stdout.write(self.style.SUCCESS("Done. Nothing was changed."))
        if options["fail_on_findings"] and findings:
            raise SystemExit(1)
