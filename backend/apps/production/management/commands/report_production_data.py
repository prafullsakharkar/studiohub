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
* tasks that name a shot, asset or sequence but are not linked to one, and why (the link was added
  by migration 0036, which links what it can prove; DECISIONS D-28)
* versions that migration 0038 would refuse (both a shot and an asset; several live hero versions on
  one shot or asset; no project that can be derived) and, as information, how many versions share a
  number within their series (DECISIONS D-29)
* as information, the entries in the old JSON lists of reviews that migration 0041 cannot turn into rows
  (they are skipped and printed by the migration; the JSON stays until the contract phase; DECISIONS D-30)
* as information, the playlist entries migration 0043 cannot turn into rows (a version outside the
  playlist's project, an entry that is not an object; DECISIONS D-31)
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


_ENTITY_MODELS = {"shot": Shot, "asset": Asset, "sequence": Sequence}


def unlinked_task_entities():
    """``[(task id, code, entity type, entity text, reason)]`` for tasks naming a record they are not linked to."""
    from uuid import UUID

    found = []
    tasks = Task.all_objects.filter(
        shot__isnull=True, asset__isnull=True, sequence__isnull=True
    ).exclude(entity_id="")
    for task in tasks.iterator():
        kind = (task.entity_type or "").strip().lower()
        text = (task.entity_id or "").strip()
        model = _ENTITY_MODELS.get(kind)
        if model is None:
            reason = f'unknown entity type "{task.entity_type}"'
        elif task.project_id is None:
            reason = "the task has no project"
        else:
            try:
                uid = UUID(text)
            except ValueError:
                codes = {c for c in (text, (task.entity_code or "").strip()) if c}
                hits = {
                    pk
                    for code in codes
                    for pk in model.all_objects.filter(
                        project_id=task.project_id, code__iexact=code
                    ).values_list("pk", flat=True)
                }
                reason = (
                    "no record of that code in the project"
                    if not hits
                    else "several records match the id and code"
                    if len(hits) > 1
                    else "a single match exists (run migration 0036)"
                )
            else:
                row = model.all_objects.filter(pk=uid).values_list("project_id", flat=True).first()
                reason = (
                    "no record with that id"
                    if row is None
                    else "the record belongs to another project"
                    if row != task.project_id
                    else "a match exists (run migration 0036)"
                )
        found.append((str(task.pk), task.code, task.entity_type, text, reason))
    return found


def review_json_not_convertible():
    """Lines like ``review R1: versions[2] matches no version of the project`` (a dry run of 0041)."""
    from types import SimpleNamespace

    from django.contrib.auth import get_user_model

    from apps.production.models import Review
    from apps.production.services.review_legacy import import_review

    # the row classes stay None: a dry run neither reads nor writes the row tables
    models_ = SimpleNamespace(
        Version=Version,
        User=get_user_model(),
        Item=None,
        Participant=None,
        Comment=None,
        Note=None,
        Annotation=None,
        Activity=None,
    )
    found: list[str] = []
    for review in Review.all_objects.all().iterator():
        found += import_review(review, models=models_, dry_run=True)  # pyright: ignore[reportArgumentType]
    return found


def playlist_json_not_convertible():
    """Lines like ``playlist P1: entries[2] names no version of the project`` (a dry run of 0043)."""
    from types import SimpleNamespace

    from apps.production.services.playlist_legacy import import_playlist

    models_ = SimpleNamespace(
        Version=Version, Entry=None
    )  # a dry run never touches the entry table
    found: list[str] = []
    for playlist in Playlist.all_objects.all().iterator():
        found += import_playlist(playlist, models=models_, dry_run=True)  # pyright: ignore[reportArgumentType]
    return found


def version_blockers():
    """``[(version id, code, problem)]`` for versions migration 0038 refuses until fixed."""
    from collections import Counter

    found = []
    for pk, code in Version.all_objects.filter(shot__isnull=False, asset__isnull=False).values_list(
        "pk", "code"
    ):
        found.append((str(pk), code, "has both a shot and an asset"))
    heroes = Counter()
    for shot_id, asset_id in Version.objects.filter(is_hero=True).values_list(
        "shot_id", "asset_id"
    ):
        if shot_id:
            heroes[("shot", shot_id)] += 1
        if asset_id:
            heroes[("asset", asset_id)] += 1
    for (kind, pk), count in heroes.items():
        if count > 1:
            found.append((str(pk), kind, f"{count} live hero versions"))
    for version in Version.all_objects.filter(project__isnull=True).select_related(
        "shot", "asset", "task"
    ):
        sources = {
            link.project_id
            for link in (version.shot, version.asset, version.task)
            if link is not None and link.project_id
        }
        if len(sources) != 1:
            found.append((str(version.pk), version.code, "no project, and none can be derived"))
    return found


def versions_sharing_a_number():
    """How many versions have the same ``version_index`` as another in their series."""
    from django.db.models import Count

    total = 0
    for field, extra in (
        ("task", {}),
        ("shot", {"task__isnull": True}),
        ("asset", {"task__isnull": True}),
    ):
        groups = (
            Version.all_objects.filter(**{f"{field}__isnull": False}, **extra)
            .values(field, "version_index")
            .annotate(n=Count("pk"))
            .filter(n__gt=1)
        )
        total += sum(group["n"] for group in groups)
    return total


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

        unlinked = unlinked_task_entities()
        self.stdout.write(f"Tasks naming a record they are not linked to: {len(unlinked)}")
        for pk, code, kind, text, reason in unlinked[:50]:
            findings += 1
            self.stdout.write(f"  task {code} {pk}: {kind} {text!r}: {reason}")

        blockers = version_blockers()
        self.stdout.write(f"Versions that block migration 0038: {len(blockers)}")
        for pk, code, problem in blockers[:50]:
            findings += 1
            self.stdout.write(f"  {code} {pk}: {problem}")
        self.stdout.write(
            f"  Versions sharing a number within their series (information): {versions_sharing_a_number()}"
        )

        unreadable = review_json_not_convertible()
        self.stdout.write(
            f"Review list entries migration 0041 cannot convert (information): {len(unreadable)}"
        )
        for line in unreadable[:50]:
            self.stdout.write(f"  {line}")

        unreadable = playlist_json_not_convertible()
        self.stdout.write(
            f"Playlist entries migration 0043 cannot convert (information): {len(unreadable)}"
        )
        for line in unreadable[:50]:
            self.stdout.write(f"  {line}")

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
