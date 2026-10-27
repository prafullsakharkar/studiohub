"""
Delivery codes are unique in any case (docs/deliveries/CONTRACTS.md DOM-DLV-01).

Refuses, changing nothing, while two deliveries share a code once case is ignored (soft-deleted
deliveries included, they keep their code). The message lists them; give one of each pair another
code, then migrate again. The read-only query D2 in docs/delivery-pipeline/ANALYSIS.md section 8
counts them beforehand.
"""

import django.db.models.functions.text
from django.db import migrations, models
from django.db.models import Count
from django.db.models.functions import Upper


def refuse_duplicate_codes(apps, schema_editor):
    Package = apps.get_model("deliveries", "DeliveryPackage")
    duplicated = list(
        Package._base_manager.annotate(ucode=Upper("code"))
        .values("ucode")
        .annotate(n=Count("id"))
        .filter(n__gt=1)
        .order_by("ucode")
    )
    if not duplicated:
        return
    lines = []
    for entry in duplicated[:50]:
        rows = Package._base_manager.annotate(ucode=Upper("code")).filter(ucode=entry["ucode"])
        lines.append(
            f"  {entry['ucode']}: "
            + ", ".join(f"{row.id} ({row.code}, deleted={row.is_deleted})" for row in rows)
        )
    more = f"\n  ... and {len(duplicated) - 50} more" if len(duplicated) > 50 else ""
    raise RuntimeError(
        "deliveries 0007 stopped, nothing was changed: these delivery codes are used more than "
        "once when case is ignored. Give all but one of each a new code, then migrate again.\n"
        + "\n".join(lines)
        + more
    )


class Migration(migrations.Migration):
    dependencies = [
        ("deliveries", "0006_package_fields"),
    ]

    operations = [
        migrations.RunPython(refuse_duplicate_codes, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="deliverypackage",
            constraint=models.UniqueConstraint(
                django.db.models.functions.text.Upper("code"), name="deliveries_package_ucode_uniq"
            ),
        ),
    ]
