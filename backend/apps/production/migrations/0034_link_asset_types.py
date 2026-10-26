"""
Link each asset to the catalog asset type its ``category`` names.

``category`` is one of a fixed list of words ("Character", "Prop", ...). The masterdata catalog has
its own asset types; where exactly one live catalog entry has a code or a name equal to the category
(any case), the assets of that category get it. A category that matches no entry, or more than one,
is left unlinked: nothing is guessed and nothing fails (DECISIONS D-27). ``manage.py
report_production_data`` lists what is left. The category itself is untouched.

Reverse does nothing (reversing 0033 drops the column).
"""

from django.db import migrations

from apps.core.logging.logger import get_logger

logger = get_logger("production")


def link_asset_types(apps, schema_editor):
    Asset = apps.get_model("production", "Asset")
    MasterAssetType = apps.get_model("masterdata", "MasterAssetType")
    by_word: dict[str, set] = {}
    for entry in MasterAssetType._base_manager.filter(is_deleted=False):
        for word in (entry.code, entry.name):
            by_word.setdefault((word or "").strip().lower(), set()).add(entry.pk)
    linked = 0
    left = 0
    for category in list(Asset._base_manager.filter(asset_type__isnull=True).values_list("category", flat=True).distinct()):
        matches = by_word.get((category or "").strip().lower(), set())
        rows = Asset._base_manager.filter(asset_type__isnull=True, category=category)
        if len(matches) == 1:
            linked += rows.update(asset_type_id=next(iter(matches)))
        else:
            left += rows.count()
    logger.info("asset_type_backfill", linked=linked, unlinked=left)


class Migration(migrations.Migration):
    dependencies = [("production", "0033_task_types_and_templates")]

    operations = [migrations.RunPython(link_asset_types, migrations.RunPython.noop)]
