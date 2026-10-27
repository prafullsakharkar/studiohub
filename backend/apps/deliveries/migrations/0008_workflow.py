"""
The delivery workflow (docs/deliveries/CONTRACTS.md DOM-DLV-01, DOM-DLV-02, DOM-DLV-11).

* the append-only status history (``deliveries_status_change``);
* the Signed Off status, the sign-off and client-answer columns, the cancellation and rejection
  reasons in their own columns, and ``revision_of``;
* a creation row in the history for every existing delivery (from "" to Draft, by ``created_by``),
  so separation of duties has the creator on record for deliveries made before the history existed.
  Earlier moves of an existing delivery are not known and are not invented.

Additive; reversible (the reverse drops what this adds).
"""

import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


def record_creations(apps, schema_editor):
    Package = apps.get_model("deliveries", "DeliveryPackage")
    Change = apps.get_model("deliveries", "DeliveryStatusChange")
    batch = []
    for pk, created_by_id, created_at in Package._base_manager.values_list(
        "pk", "created_by_id", "created_at"
    ).iterator():
        batch.append(
            Change(
                delivery_id=pk,
                from_status="",
                to_status="Draft",
                actor_id=created_by_id,
                at=created_at or django.utils.timezone.now(),
            )
        )
        if len(batch) >= 500:
            Change.objects.bulk_create(batch)
            batch = []
    if batch:
        Change.objects.bulk_create(batch)


class Migration(migrations.Migration):
    dependencies = [
        ("deliveries", "0007_code_unique"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DeliveryStatusChange",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("from_status", models.CharField(blank=True, default="", max_length=20)),
                ("to_status", models.CharField(max_length=20)),
                ("reason", models.CharField(blank=True, default="", max_length=500)),
                (
                    "override_kind",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("", "Ordinary move"),
                            ("status", "Status override"),
                            ("self_approval", "Self sign-off override"),
                            ("system", "System"),
                        ],
                        default="",
                        max_length=20,
                    ),
                ),
                (
                    "at",
                    models.DateTimeField(default=django.utils.timezone.now, editable=False),
                ),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "delivery",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="status_changes",
                        to="deliveries.deliverypackage",
                    ),
                ),
            ],
            options={
                "db_table": "deliveries_status_change",
                "ordering": ("at", "id"),
                "indexes": [
                    models.Index(fields=["delivery", "to_status"], name="deliveries_hist_to_idx")
                ],
            },
        ),
        migrations.AlterField(
            model_name="deliverypackage",
            name="status",
            field=models.CharField(
                choices=[
                    ("Draft", "Draft"),
                    ("Validating", "Validating"),
                    ("Prepared", "Prepared"),
                    ("Signed Off", "Signed Off"),
                    ("Submitted", "Submitted"),
                    ("Approved", "Approved"),
                    ("Rejected", "Rejected"),
                    ("Complete", "Complete"),
                    ("Cancelled", "Cancelled"),
                ],
                db_index=True,
                default="Draft",
                help_text="Delivery package status",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="deliverypackage",
            name="signed_off_by",
            field=models.ForeignKey(
                blank=True,
                help_text="Who signed the delivery off (internal approval)",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="deliverypackage",
            name="signed_off_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="deliverypackage",
            name="client_answered_by",
            field=models.ForeignKey(
                blank=True,
                help_text="Who recorded the client's answer",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="deliverypackage",
            name="client_answered_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="deliverypackage",
            name="cancellation_reason",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="deliverypackage",
            name="rejection_reason",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="deliverypackage",
            name="revision_of",
            field=models.ForeignKey(
                blank=True,
                help_text="The rejected delivery this one re-delivers",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="revisions",
                to="deliveries.deliverypackage",
            ),
        ),
        migrations.RunPython(record_creations, migrations.RunPython.noop),
    ]
