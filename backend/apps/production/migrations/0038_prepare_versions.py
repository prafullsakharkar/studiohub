"""
Get existing versions ready for the numbering, consistency and hero constraints of migration 0039.

1. **Refuses, changing nothing,** when a row would break a new constraint and there is no safe fix,
   and says which rows: a version with both a shot and an asset; a shot or an asset with more than
   one live hero version; a version with no project that cannot be given one (its shot, asset and
   task name no project, or not the same one). Fix those rows and migrate again.
2. **Fills** a missing ``project`` from the project of the version's shot, asset and task when they
   all agree.
3. **Backfills** ``published_at`` of published versions from ``publishing_info["published_at"]``
   when it parses (otherwise it stays empty).
4. **Numbers** each series (the versions of a task, or of a shot or asset when they have no task):
   ``version_index`` takes the number in ``version_number`` ("v003" is 3) when that is free in its
   series, and the next unused numbers go to the rest in creation order, so the index is unique per
   series. ``version_number`` itself is never rewritten. Versions linked to nothing keep their index.

``manage.py report_production_data`` lists what would be refused before you migrate. DECISIONS D-29.
Reverse does nothing.
"""

import re
from collections import Counter

from django.db import migrations
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.core.logging.logger import get_logger

logger = get_logger("production")

NUMBER = re.compile(r"[vV]?0*(\d+)")
SHOWN = 40


def _number_of(text):
    match = NUMBER.fullmatch((text or "").strip())
    value = int(match.group(1)) if match else 0
    return value or None


def prepare_versions(apps, schema_editor):
    Version = apps.get_model("production", "Version")
    shot_project = dict(apps.get_model("production", "Shot")._base_manager.values_list("pk", "project_id"))
    asset_project = dict(apps.get_model("production", "Asset")._base_manager.values_list("pk", "project_id"))
    task_project = dict(apps.get_model("production", "Task")._base_manager.values_list("pk", "project_id"))
    rows = list(
        Version._base_manager.values(
            "id", "project_id", "shot_id", "asset_id", "task_id", "version_number", "is_hero",
            "is_deleted", "is_published", "published_at", "publishing_info", "created_at",
        )
    )  # fmt: skip

    problems = []
    fills = {}
    heroes = Counter()
    for row in rows:
        if row["shot_id"] and row["asset_id"]:
            problems.append(f"version {row['id']}: has both a shot and an asset")
        if row["project_id"] is None:
            sources = {
                pid
                for pid in (
                    shot_project.get(row["shot_id"]),
                    asset_project.get(row["asset_id"]),
                    task_project.get(row["task_id"]),
                )
                if pid
            }
            if len(sources) == 1:
                fills[row["id"]] = next(iter(sources))
            else:
                why = "name different projects" if sources else "name no project"
                problems.append(f"version {row['id']}: no project, and its shot, asset and task {why}")
        if row["is_hero"] and not row["is_deleted"]:
            if row["shot_id"]:
                heroes[("shot", row["shot_id"])] += 1
            if row["asset_id"]:
                heroes[("asset", row["asset_id"])] += 1
    for (kind, pk), count in heroes.items():
        if count > 1:
            problems.append(f"{kind} {pk}: {count} live hero versions")
    if problems:
        shown = "\n  ".join(problems[:SHOWN])
        more = f"\n  ... and {len(problems) - SHOWN} more" if len(problems) > SHOWN else ""
        raise RuntimeError(
            "production 0038 cannot prepare versions for their new constraints: "
            f"{len(problems)} row(s) need fixing first. Resolve these, then migrate again:\n  {shown}{more}"
        )

    for version_id, project_id in fills.items():
        Version._base_manager.filter(pk=version_id).update(project_id=project_id)

    for row in rows:
        if row["is_published"] and row["published_at"] is None:
            stamp = parse_datetime(str((row["publishing_info"] or {}).get("published_at") or ""))
            if stamp is not None:
                if timezone.is_naive(stamp):
                    stamp = timezone.make_aware(stamp, timezone.utc)
                Version._base_manager.filter(pk=row["id"]).update(published_at=stamp)

    series = {}
    for row in rows:
        if row["task_id"]:
            key = ("task", row["task_id"])
        elif row["shot_id"]:
            key = ("shot", row["shot_id"])
        elif row["asset_id"]:
            key = ("asset", row["asset_id"])
        else:
            continue
        series.setdefault(key, []).append(row)
    renumbered = 0
    for members in series.values():
        used = set()
        assigned = {}
        leftovers = []
        for row in sorted(members, key=lambda r: (_number_of(r["version_number"]) is None, _number_of(r["version_number"]) or 0, r["created_at"], str(r["id"]))):
            number = _number_of(row["version_number"])
            if number is not None and number not in used:
                assigned[row["id"]] = number
                used.add(number)
            else:
                leftovers.append(row)
        counter = max(used, default=0) + 1
        for row in sorted(leftovers, key=lambda r: (r["created_at"], str(r["id"]))):
            assigned[row["id"]] = counter
            counter += 1
            renumbered += 1
        for row_id, index in assigned.items():
            Version._base_manager.filter(pk=row_id).exclude(version_index=index).update(version_index=index)
    logger.info(
        "versions_prepared",
        versions=len(rows),
        project_filled=len(fills),
        series=len(series),
        given_a_new_index=renumbered,
    )


class Migration(migrations.Migration):
    dependencies = [("production", "0037_version_published_by")]

    operations = [migrations.RunPython(prepare_versions, migrations.RunPython.noop)]
