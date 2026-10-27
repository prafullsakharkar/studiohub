"""
Publish job codes are unique in any case (docs/publishing/CONTRACTS.md DOM-PUB-05).

Refuses, changing nothing, while two jobs share a code once case is ignored (soft-deleted
jobs included, they keep their code). The message lists them; give one of each pair another
code, then migrate again. The read-only query P2 in docs/delivery-pipeline/ANALYSIS.md section 8
counts them beforehand.
"""

import django.db.models.functions.text
from django.db import migrations, models
from django.db.models import Count
from django.db.models.functions import Upper


def refuse_duplicate_codes(apps, schema_editor):
    PublishItem = apps.get_model("publishing", "PublishItem")
    duplicated = list(
        PublishItem._base_manager.annotate(ucode=Upper("code"))
        .values("ucode")
        .annotate(n=Count("id"))
        .filter(n__gt=1)
        .order_by("ucode")
    )
    if not duplicated:
        return
    lines = []
    for entry in duplicated[:50]:
        ids = list(
            PublishItem._base_manager.annotate(ucode=Upper("code"))
            .filter(ucode=entry["ucode"])
            .values_list("id", "code", "is_deleted")
        )
        lines.append(f"  {entry['ucode']}: " + ", ".join(f"{i} ({c}, deleted={d})" for i, c, d in ids))
    more = f"\n  ... and {len(duplicated) - 50} more" if len(duplicated) > 50 else ""
    raise RuntimeError(
        "publishing 0008 stopped, nothing was changed: these publish job codes are used more than "
        "once when case is ignored. Give all but one of each a new code, then migrate again.\n"
        + "\n".join(lines)
        + more
    )


class Migration(migrations.Migration):
    dependencies = [
        ("publishing", "0007_publish_item_links"),
    ]

    operations = [
        migrations.RunPython(refuse_duplicate_codes, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="publishitem",
            constraint=models.UniqueConstraint(
                django.db.models.functions.text.Upper("code"), name="publishing_item_ucode_uniq"
            ),
        ),
    ]
