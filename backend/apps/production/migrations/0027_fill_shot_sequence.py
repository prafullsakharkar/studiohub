"""
Link each shot to the sequence its ``sequence_code`` text names.

Per project, a shot's text is matched to a sequence of the same project ignoring case
(migration 0025 guarantees at most one sequence per code, soft-deleted ones included, so
the match is never ambiguous). Shots whose text matches nothing are left with
``sequence = NULL`` and their text untouched; nothing is lost and nothing fails
(DECISIONS D-11). List them with ``manage.py report_production_data``.

Reverse: nothing to undo; reversing 0026 drops the column and the text stays.
"""

from django.db import migrations

from apps.core.logging.logger import get_logger

logger = get_logger("production")


def link_shots(apps, schema_editor):
    Sequence = apps.get_model("production", "Sequence")
    Shot = apps.get_model("production", "Shot")
    linked = 0
    for sequence in Sequence._base_manager.all().iterator():
        linked += Shot._base_manager.filter(
            project_id=sequence.project_id,
            sequence__isnull=True,
            sequence_code__iexact=sequence.code,
        ).update(sequence_id=sequence.pk, sequence_code=sequence.code)
    left = Shot._base_manager.filter(sequence__isnull=True).exclude(sequence_code="").count()
    logger.info("shot_sequence_backfill", linked=linked, unmatched=left)
    if left:
        logger.warning(
            "shot_sequence_unmatched",
            shots=left,
            hint="run `manage.py report_production_data` to list them",
        )


class Migration(migrations.Migration):
    dependencies = [("production", "0026_shot_sequence")]

    operations = [migrations.RunPython(link_shots, migrations.RunPython.noop)]
