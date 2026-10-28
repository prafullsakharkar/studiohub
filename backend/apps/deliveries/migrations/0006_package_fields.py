"""
What was sent (sent_by, sent_at, transfer_reference), the latest QC run, and the per-project counter
for server-made delivery codes.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("deliveries", "0005_items_snapshot_qc"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DeliveryCounter",
            fields=[
                ("project_id", models.UUIDField(primary_key=True, serialize=False)),
                ("last_number", models.PositiveIntegerField(default=0)),
            ],
            options={
                "db_table": "deliveries_counter",
            },
        ),
        migrations.AddField(
            model_name="deliverypackage",
            name="qc_run_id",
            field=models.UUIDField(
                blank=True,
                help_text="The latest QC run of this delivery (rows in DeliveryQCCheck)",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="deliverypackage",
            name="sent_at",
            field=models.DateTimeField(
                blank=True,
                help_text="When the delivery was sent (the real time, not the last edit)",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="deliverypackage",
            name="sent_by",
            field=models.ForeignKey(
                blank=True,
                help_text="Who sent the delivery",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="deliverypackage",
            name="transfer_reference",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Id of the transfer outside StudioHub (Aspera job, ticket), typed by the sender",
                max_length=200,
            ),
        ),
    ]
