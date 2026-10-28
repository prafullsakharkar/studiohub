"""
Destination names are unique in any case among live rows, and one destination is the default
(docs/publishing/CONTRACTS.md DOM-PUB-06).

Replaces the case-sensitive constraint that also counted soft-deleted rows. Refuses, changing
nothing, while two live destinations share a name once case is ignored or more than one live
destination is the default; the message lists them.
"""

import django.db.models.functions.text
from django.db import migrations, models
from django.db.models import Count
from django.db.models.functions import Upper


def refuse_conflicts(apps, schema_editor):
    Destination = apps.get_model("publishing", "PublishDestination")
    live = Destination._base_manager.filter(is_deleted=False)
    problems = []
    for entry in (
        live.annotate(uname=Upper("name")).values("uname").annotate(n=Count("id")).filter(n__gt=1)
    ):
        rows = live.annotate(uname=Upper("name")).filter(uname=entry["uname"])
        problems.append(
            f"  name {entry['uname']}: " + ", ".join(f"{r.id} ({r.name})" for r in rows)
        )
    defaults = list(live.filter(is_default=True))
    if len(defaults) > 1:
        problems.append("  several defaults: " + ", ".join(f"{r.id} ({r.name})" for r in defaults))
    if problems:
        raise RuntimeError(
            "publishing 0009 stopped, nothing was changed: fix these publish destinations "
            "(rename duplicates, keep one default), then migrate again.\n" + "\n".join(problems)
        )


class Migration(migrations.Migration):
    dependencies = [
        ("publishing", "0008_publish_item_code_unique"),
    ]

    operations = [
        migrations.RunPython(refuse_conflicts, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="publishdestination",
            name="uniq_publish_destination_name",
        ),
        migrations.AddConstraint(
            model_name="publishdestination",
            constraint=models.UniqueConstraint(
                django.db.models.functions.text.Upper("name"),
                condition=models.Q(("is_deleted", False)),
                name="publishing_destination_uname_uniq",
            ),
        ),
        migrations.AddConstraint(
            model_name="publishdestination",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_default", True), ("is_deleted", False)),
                fields=("is_default",),
                name="publishing_destination_one_default",
            ),
        ),
    ]
