"""
Delivery destinations (docs/deliveries/CONTRACTS.md DOM-DLV-10, API-DLV-18, decision Q33).

* ``DeliveryPackage.destination``: a nullable foreign key (PROTECT) to the destination, replacing
  the free-text ``delivery_destination`` (kept, deprecated, nothing is dropped).
* A destination name is unique in any case among live destinations, and at most one live
  destination is the default.

Refuses, changing nothing, while two live destinations share a name once case is ignored or more
than one live destination is the default: the message lists them; fix them, then migrate again.
Additive and reversible (the reverse restores the old case-sensitive name constraint).
"""

import django.db.models.deletion
import django.db.models.functions.text
from django.db import migrations, models
from django.db.models import Count, Q
from django.db.models.functions import Upper


def refuse_conflicts(apps, schema_editor):
    Destination = apps.get_model("deliveries", "DeliveryDestination")
    live = Destination._base_manager.filter(is_deleted=False)
    lines = []
    duplicated = (
        live.annotate(uname=Upper("name"))
        .values("uname")
        .annotate(n=Count("id"))
        .filter(n__gt=1)
        .order_by("uname")
    )
    for entry in list(duplicated)[:50]:
        rows = live.annotate(uname=Upper("name")).filter(uname=entry["uname"])
        lines.append(
            f"  name {entry['uname']}: " + ", ".join(f"{row.id} ({row.name})" for row in rows)
        )
    defaults = list(live.filter(is_default=True))
    if len(defaults) > 1:
        lines.append(
            "  more than one default: " + ", ".join(f"{row.id} ({row.name})" for row in defaults)
        )
    if lines:
        raise RuntimeError(
            "deliveries 0010 stopped, nothing was changed. Rename the destinations that share a "
            "name once case is ignored and leave one default, then migrate again.\n"
            + "\n".join(lines)
        )


class Migration(migrations.Migration):
    dependencies = [
        ("deliveries", "0009_encrypt_passcode"),
    ]

    operations = [
        migrations.RunPython(refuse_conflicts, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="deliverydestination",
            name="uniq_delivery_destination_name",
        ),
        migrations.AddConstraint(
            model_name="deliverydestination",
            constraint=models.UniqueConstraint(
                django.db.models.functions.text.Upper("name"),
                condition=Q(is_deleted=False),
                name="deliveries_dest_uname_live_uniq",
            ),
        ),
        migrations.AddConstraint(
            model_name="deliverydestination",
            constraint=models.UniqueConstraint(
                fields=["is_default"],
                condition=Q(is_default=True, is_deleted=False),
                name="deliveries_dest_one_default",
            ),
        ),
        migrations.AddField(
            model_name="deliverypackage",
            name="destination",
            field=models.ForeignKey(
                blank=True,
                help_text="Where the delivery goes (replaces the free-text destination)",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="packages",
                to="deliveries.deliverydestination",
            ),
        ),
        migrations.AlterField(
            model_name="deliverypackage",
            name="delivery_destination",
            field=models.TextField(
                blank=True,
                help_text=(
                    "Deprecated free text. Used only while no destination is chosen; with a "
                    "destination the API shows the destination's own address."
                ),
            ),
        ),
    ]
