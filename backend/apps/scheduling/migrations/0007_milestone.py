"""
Project milestones (docs/scheduling/CONTRACTS.md DOM-SCH-06, decision Q22).

Creates ``Milestone``: real, dated points of a project's plan that replace the phases Production used
to invent. A milestone name is unique within its project in any case; a delivery milestone must name
a delivery (no foreign key); a completed one carries the time it was completed. Additive; the reverse
drops the table.
"""

import uuid

import apps.core.models.mixins.soft_delete
import django.db.models.deletion
import django.db.models.functions.text
from django.conf import settings
from django.db import migrations, models


def _user_link(related, text):
    return models.ForeignKey(
        blank=True,
        editable=False,
        help_text=text,
        null=True,
        on_delete=django.db.models.deletion.SET_NULL,
        related_name=related,
        to=settings.AUTH_USER_MODEL,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("scheduling", "0006_checks_protect"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Milestone",
            fields=[
                ("is_deleted", models.BooleanField(db_index=True, default=False)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True, db_index=True, help_text="Object creation timestamp."
                    ),
                ),
                (
                    "updated_at",
                    models.DateTimeField(
                        auto_now=True, db_index=True, help_text="Last update timestamp."
                    ),
                ),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        help_text="Universally unique identifier.",
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "name",
                    models.CharField(
                        help_text="Milestone name (unique within the project, any case)",
                        max_length=255,
                    ),
                ),
                (
                    "due_date",
                    models.DateField(
                        help_text="The day the milestone is due (a date in the project's calendar zone)"
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("Pending", "Pending"),
                            ("In Progress", "In Progress"),
                            ("Completed", "Completed"),
                        ],
                        db_index=True,
                        default="Pending",
                        help_text="Milestone status",
                        max_length=20,
                    ),
                ),
                (
                    "order",
                    models.PositiveIntegerField(
                        default=0, help_text="Display order within the project"
                    ),
                ),
                (
                    "kind",
                    models.CharField(
                        choices=[("general", "General"), ("delivery", "Delivery")],
                        default="general",
                        help_text="General, or tied to a delivery of the project",
                        max_length=20,
                    ),
                ),
                (
                    "delivery_package_id",
                    models.UUIDField(
                        blank=True,
                        help_text="A delivery of this project (no foreign key: Scheduling does not import Deliveries)",
                        null=True,
                    ),
                ),
                ("notes", models.TextField(blank=True, help_text="Notes")),
                (
                    "completed_at",
                    models.DateTimeField(
                        blank=True, help_text="When the milestone was completed", null=True
                    ),
                ),
                (
                    "completed_by",
                    models.ForeignKey(
                        blank=True,
                        help_text="Who completed the milestone",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "created_by",
                    _user_link("%(app_label)s_%(class)s_created", "User who created this object."),
                ),
                (
                    "deleted_by",
                    _user_link("%(app_label)s_%(class)s_deleted", "User who deleted this object."),
                ),
                (
                    "updated_by",
                    _user_link(
                        "%(app_label)s_%(class)s_updated", "User who last updated this object."
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        help_text="The project this milestone belongs to",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="milestones",
                        to="production.project",
                    ),
                ),
            ],
            options={
                "verbose_name": "Milestone",
                "verbose_name_plural": "Milestones",
                "db_table": "scheduling_milestone",
                "ordering": ("project", "order", "due_date", "name"),
            },
            bases=(models.Model, apps.core.models.mixins.soft_delete.SoftDeleteMixin),
        ),
        migrations.AddConstraint(
            model_name="milestone",
            constraint=models.UniqueConstraint(
                models.F("project"),
                django.db.models.functions.text.Upper("name"),
                condition=models.Q(("is_deleted", False)),
                name="scheduling_milestone_project_uname_live_uniq",
            ),
        ),
        migrations.AddConstraint(
            model_name="milestone",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(("kind", "delivery"), _negated=True),
                    ("delivery_package_id__isnull", False),
                    _connector="OR",
                ),
                name="scheduling_milestone_delivery_needs_package",
            ),
        ),
        migrations.AddConstraint(
            model_name="milestone",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(("status", "Completed"), _negated=True),
                    ("completed_at__isnull", False),
                    _connector="OR",
                ),
                name="scheduling_milestone_completed_has_time",
            ),
        ),
    ]
