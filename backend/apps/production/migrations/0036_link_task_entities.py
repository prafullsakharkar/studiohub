"""
Link each task to the shot, asset or sequence its ``entity_type`` / ``entity_id`` text names.

For a task of a project, with ``entity_type`` Shot, Asset or Sequence:

* ``entity_id`` is a UUID: the record with that id **in the task's own project** (an archived one
  counts: the link keeps the history intact);
* ``entity_id`` is not a UUID (an old code or a mock id): the one record of that kind in the project
  whose code equals ``entity_code`` or ``entity_id`` (any case), if exactly one does.

Everything else is left unlinked with its text untouched: a record of another project, no match, several
matches, an unknown type, a task without a project. Nothing is guessed and, because no constraint is
added over the old text, nothing needs to fail (DECISIONS D-28). ``manage.py report_production_data``
lists the tasks still unlinked. Tasks with no entity at all (empty ``entity_id``) are project-level
and need nothing.

Reverse does nothing (reversing 0035 drops the columns).
"""

from uuid import UUID

from django.db import migrations

from apps.core.logging.logger import get_logger

logger = get_logger("production")

KINDS = {"shot": ("Shot", "shot_id"), "asset": ("Asset", "asset_id"), "sequence": ("Sequence", "sequence_id")}


def link_task_entities(apps, schema_editor):
    Task = apps.get_model("production", "Task")
    models = {kind: apps.get_model("production", name) for kind, (name, _) in KINDS.items()}
    linked = 0
    unlinked = 0
    tasks = Task._base_manager.filter(
        shot__isnull=True, asset__isnull=True, sequence__isnull=True, project__isnull=False
    ).exclude(entity_id="")
    for task in tasks.iterator():
        kind = (task.entity_type or "").strip().lower()
        if kind not in KINDS:
            unlinked += 1
            continue
        model, column = models[kind], KINDS[kind][1]
        base = model._base_manager.filter(project_id=task.project_id)
        match = None
        text = (task.entity_id or "").strip()
        try:
            match = base.filter(pk=UUID(text)).first()
        except ValueError:
            codes = {c for c in (text, (task.entity_code or "").strip()) if c}
            hits = {row.pk for code in codes for row in base.filter(code__iexact=code)}
            if len(hits) == 1:
                match = base.filter(pk=next(iter(hits))).first()
        if match is None:
            unlinked += 1
            continue
        Task._base_manager.filter(pk=task.pk).update(**{column: match.pk})
        linked += 1
    logger.info("task_entity_backfill", linked=linked, unlinked=unlinked)
    if unlinked:
        logger.warning(
            "task_entity_unlinked",
            tasks=unlinked,
            hint="run `manage.py report_production_data` to list them",
        )


class Migration(migrations.Migration):
    dependencies = [("production", "0035_task_entity_links")]

    operations = [migrations.RunPython(link_task_entities, migrations.RunPython.noop)]
