"""
On-delete rules that kept history: a package or a version with delivery history can no longer be
hard-deleted (docs/delivery-pipeline Q24). A change of Django's delete rule only: no SQL runs.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        (
            "deliveries",
            "0003_remove_deliverydestination_uniq_delivery_destination_name_per_org_and_more",
        ),
    ]

    operations = [
        migrations.AlterField(
            model_name="deliverypackage",
            name="client",
            field=models.ForeignKey(
                blank=True,
                help_text="Client recipient",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="delivery_packages",
                to="masterdata.client",
            ),
        ),
        migrations.AlterField(
            model_name="deliverypackage",
            name="project",
            field=models.ForeignKey(
                blank=True,
                help_text="Associated project",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="delivery_packages",
                to="production.project",
            ),
        ),
        migrations.AlterField(
            model_name="deliveryversionref",
            name="delivery",
            field=models.ForeignKey(
                help_text="Delivery package",
                on_delete=django.db.models.deletion.PROTECT,
                related_name="versions",
                to="deliveries.deliverypackage",
            ),
        ),
        migrations.AlterField(
            model_name="deliveryversionref",
            name="version",
            field=models.ForeignKey(
                help_text="Version being delivered",
                on_delete=django.db.models.deletion.PROTECT,
                related_name="delivery_references",
                to="production.version",
            ),
        ),
    ]
