"""
Archived means soft-deleted: soft-delete the rows that only carry the old ``is_archived`` flag.

Task, Asset, Version, Playlist and Workflow had two archive markers. From this migration on the
API treats a row as archived exactly when it is soft-deleted (DECISIONS D-25), so a row with the
flag set and no soft delete would turn invisible to lists only after the code change; this
migration makes the data say what the code now says. Rows that are already soft-deleted, and the
flag itself, are left alone (the column is dropped in the final cleanup).

Run ``manage.py report_production_data`` first: its "archive flag" section counts the rows this
touches ("flag only"). The ids are logged (first 500 per model) so any of them can be restored
by hand. Reverse does nothing: it cannot tell these rows from rows archived the proper way.
"""

from django.db import migrations
from django.utils import timezone

from apps.core.logging.logger import get_logger

logger = get_logger("production")

MODELS = ("Task", "Asset", "Version", "Playlist", "Workflow")
LOGGED_IDS = 500


def soft_delete_flagged_rows(apps, schema_editor):
    now = timezone.now()
    for name in MODELS:
        model = apps.get_model("production", name)
        rows = model._base_manager.filter(is_archived=True, is_deleted=False)
        ids = [str(pk) for pk in rows.values_list("pk", flat=True)]
        if not ids:
            continue
        rows.update(is_deleted=True, deleted_at=now)
        logger.warning(
            "archive_flag_reconciled",
            model=name,
            soft_deleted=len(ids),
            ids=ids[:LOGGED_IDS],
        )


class Migration(migrations.Migration):
    dependencies = [("production", "0030_protect_history_rows")]

    operations = [migrations.RunPython(soft_delete_flagged_rows, migrations.RunPython.noop)]
