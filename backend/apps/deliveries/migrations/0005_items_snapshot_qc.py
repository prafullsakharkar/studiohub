"""
Items carry a server-made snapshot of the published files they deliver, and QC is recorded.

New: DeliveryItemFile (the files of an item, frozen when the delivery is sent), DeliveryQCCheck
(append-only QC records), DeliveryVersionRef.uid (the id the API uses; existing rows get one here)
and DeliveryVersionRef.added_by. Existing items keep their typed snapshot and have no item files.
"""

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def fill_uids(apps, schema_editor):
    Ref = apps.get_model("deliveries", "DeliveryVersionRef")
    for ref in Ref._base_manager.filter(uid__isnull=True).iterator():
        ref.uid = uuid.uuid4()
        ref.save(update_fields=["uid"])


class Migration(migrations.Migration):
    dependencies = [
        ("deliveries", "0004_protect_history"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DeliveryItemFile",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("published_file_id", models.UUIDField()),
                ("storage_root_code", models.CharField(max_length=50)),
                ("relative_path", models.CharField(max_length=1024)),
                ("role", models.CharField(max_length=20)),
                ("file_type_code", models.CharField(blank=True, default="", max_length=100)),
                ("size_bytes", models.PositiveBigIntegerField(default=0)),
                ("sha256", models.CharField(max_length=64)),
                ("frame_start", models.IntegerField(blank=True, null=True)),
                ("frame_end", models.IntegerField(blank=True, null=True)),
                ("frozen_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "db_table": "deliveries_item_file",
                "ordering": ("role", "relative_path"),
            },
        ),
        migrations.CreateModel(
            name="DeliveryQCCheck",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("run_id", models.UUIDField(db_index=True)),
                ("check_name", models.CharField(max_length=40)),
                (
                    "outcome",
                    models.CharField(
                        choices=[
                            ("pass", "Pass"),
                            ("fail", "Fail"),
                            ("not_checked", "Not checked"),
                        ],
                        max_length=12,
                    ),
                ),
                ("detail", models.CharField(blank=True, default="", max_length=300)),
                (
                    "checked_at",
                    models.DateTimeField(default=django.utils.timezone.now, editable=False),
                ),
            ],
            options={
                "db_table": "deliveries_qc_check",
                "ordering": ("checked_at", "check_name"),
            },
        ),
        migrations.AddField(
            model_name="deliveryversionref",
            name="added_by",
            field=models.ForeignKey(
                blank=True,
                help_text="Who added this item",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="deliveryversionref",
            name="uid",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.RunPython(fill_uids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="deliveryversionref",
            name="uid",
            field=models.UUIDField(
                default=uuid.uuid4,
                editable=False,
                help_text="Id the API uses for this item (the integer pk is kept for older clients)",
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name="deliveryitemfile",
            name="item",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="files",
                to="deliveries.deliveryversionref",
            ),
        ),
        migrations.AddField(
            model_name="deliveryqccheck",
            name="checked_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="deliveryqccheck",
            name="delivery",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="qc_checks",
                to="deliveries.deliverypackage",
            ),
        ),
        migrations.AddField(
            model_name="deliveryqccheck",
            name="item",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="qc_checks",
                to="deliveries.deliveryversionref",
            ),
        ),
        migrations.AddConstraint(
            model_name="deliveryitemfile",
            constraint=models.UniqueConstraint(
                fields=("item", "published_file_id"), name="deliveries_item_file_uniq"
            ),
        ),
        migrations.AddIndex(
            model_name="deliveryqccheck",
            index=models.Index(fields=["delivery", "run_id"], name="deliveries_qc_run_idx"),
        ),
    ]
