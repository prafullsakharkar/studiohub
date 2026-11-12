"""
RP-2 WP 2.6 (docs/review-pipeline/PLAN.md): give each existing note a link to the record its stored
``entity_type`` and ``entity_id`` name, where that record can be found.

A link is written only when the type is one a note can link to (``ProjectNoteLinkType``, compared
without regard to case), the id is a UUID, and a record of that type with that id belongs to the
note's own project (archived records included, so history is kept). Anything else keeps no link:
its ``entity_*`` columns are left exactly as they are, here and in every answer (C-RP-08). Nothing
else is changed. Running it again adds nothing (existing links are skipped). Run
``docs/review-pipeline/STAGING_AUDIT_RP2.sql`` first to see which notes will keep no link.
"""

from uuid import UUID

from django.db import migrations

LINK_TYPES = ("Episode", "Sequence", "Shot", "Asset", "Version", "Playlist", "Review")
BY_LOWER = {name.lower(): name for name in LINK_TYPES}


def backfill(apps, schema_editor):
    note_model = apps.get_model("production", "ProjectNote")
    link_model = apps.get_model("production", "ProjectNoteLink")
    models = {name: apps.get_model("production", name) for name in LINK_TYPES}

    already = set(link_model.objects.values_list("note_id", flat=True))
    rows = []
    notes = note_model._base_manager.filter(parent__isnull=True).values_list(
        "id", "project_id", "entity_type", "entity_id"
    )
    for note_id, project_id, raw_type, raw_id in notes.iterator():
        if note_id in already:
            continue
        entity_type = BY_LOWER.get((raw_type or "").strip().lower())
        if entity_type is None:
            continue
        try:
            entity_id = UUID(str(raw_id).strip())
        except ValueError:
            continue
        found = (
            models[entity_type]._base_manager.filter(pk=entity_id, project_id=project_id).exists()
        )
        if found:
            rows.append(
                link_model(
                    note_id=note_id, entity_type=entity_type, entity_id=entity_id, position=0
                )
            )
    link_model.objects.bulk_create(rows, batch_size=500, ignore_conflicts=True)


class Migration(migrations.Migration):
    dependencies = [
        ("production", "0005_rp2_note_replies_links_task"),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
