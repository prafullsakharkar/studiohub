"""Backfill global master Positions from the platform catalog.

``masterdata.PlatformPosition`` holds the global craft catalog; the people
role select reads organization.Position (global masters must be
``organization=null`` + ``scope=global_master``). Nothing synced between
the two, so fresh installs had an empty role catalog and person creation
was blocked. Idempotent: existing masters (same code, org null) are reused.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    Position = apps.get_model("organization", "Position")
    PlatformPosition = apps.get_model("masterdata", "PlatformPosition")

    for master in PlatformPosition.objects.filter(is_deleted=False):
        name = (master.title or master.code or "").strip() or "Role"
        code = ((master.code or "").strip().upper().replace(" ", "_") or name.upper().replace(" ", "_"))[:20]
        Position.objects.get_or_create(
            code=code,
            organization__isnull=True,
            defaults={
                "name": name,
                "scope": "global_master",
                "organization": None,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("organization", "0031_backfill_person_organization"),
        ("masterdata", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
