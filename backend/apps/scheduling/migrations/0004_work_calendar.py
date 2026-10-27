"""
Work calendars (docs/scheduling/CONTRACTS.md DOM-SCH-01, DOM-SCH-03, decision Q21).

Creates ``WorkCalendar`` and the optional ``Resource.calendar`` link, and a default calendar
"Studio" (UTC, Monday to Friday, 8 hours) so everything that exists keeps working as it did: a
resource with no calendar follows the default. Additive; the reverse drops the table and the link.
"""

import uuid

import apps.core.models.mixins.soft_delete
import django.db.models.deletion
import django.db.models.functions.text
from django.conf import settings
from django.db import migrations, models


def create_default_calendar(apps, schema_editor):
    WorkCalendar = apps.get_model("scheduling", "WorkCalendar")
    if WorkCalendar._base_manager.filter(is_default=True, is_deleted=False).exists():
        return
    WorkCalendar._base_manager.get_or_create(
        code="STUDIO",
        defaults={
            "name": "Studio",
            "time_zone": "UTC",
            "working_weekdays": [1, 2, 3, 4, 5],
            "hours_per_day": 8,
            "is_default": True,
        },
    )


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
        ("masterdata", "0003_client_clientcontact_clientcontract_department_and_more"),
        ("scheduling", "0003_leave_rejected_by"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkCalendar",
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
                    "code",
                    models.CharField(help_text="Unique calendar code (any case)", max_length=50),
                ),
                ("name", models.CharField(help_text="Calendar name", max_length=255)),
                (
                    "time_zone",
                    models.CharField(
                        default="UTC",
                        help_text="IANA time zone, for example Europe/London",
                        max_length=64,
                    ),
                ),
                (
                    "working_weekdays",
                    models.JSONField(
                        default=list,
                        help_text="ISO weekdays that are worked: 1 is Monday, 7 is Sunday",
                    ),
                ),
                (
                    "hours_per_day",
                    models.DecimalField(
                        decimal_places=2,
                        default=8,
                        help_text="Hours of a working day",
                        max_digits=4,
                    ),
                ),
                (
                    "is_default",
                    models.BooleanField(
                        default=False,
                        help_text="The calendar that applies when none is chosen (at most one)",
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
                    "office",
                    models.ForeignKey(
                        blank=True,
                        help_text="The office this calendar belongs to (at most one calendar per office)",
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="work_calendars",
                        to="masterdata.office",
                    ),
                ),
            ],
            options={
                "verbose_name": "Work Calendar",
                "verbose_name_plural": "Work Calendars",
                "db_table": "scheduling_work_calendar",
                "ordering": ("name",),
            },
            bases=(models.Model, apps.core.models.mixins.soft_delete.SoftDeleteMixin),
        ),
        migrations.AddConstraint(
            model_name="workcalendar",
            constraint=models.UniqueConstraint(
                django.db.models.functions.text.Upper("code"), name="scheduling_calendar_ucode_uniq"
            ),
        ),
        migrations.AddConstraint(
            model_name="workcalendar",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_deleted", False), ("office__isnull", False)),
                fields=("office",),
                name="scheduling_calendar_one_per_office",
            ),
        ),
        migrations.AddConstraint(
            model_name="workcalendar",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_default", True), ("is_deleted", False)),
                fields=("is_default",),
                name="scheduling_calendar_one_default",
            ),
        ),
        migrations.AddConstraint(
            model_name="workcalendar",
            constraint=models.CheckConstraint(
                condition=models.Q(("hours_per_day__gt", 0), ("hours_per_day__lte", 24)),
                name="scheduling_calendar_hours_in_range",
            ),
        ),
        migrations.AddField(
            model_name="resource",
            name="calendar",
            field=models.ForeignKey(
                blank=True,
                help_text="Work calendar (time zone, working week, holidays); empty means the default calendar",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="resources",
                to="scheduling.workcalendar",
            ),
        ),
        migrations.RunPython(create_default_calendar, migrations.RunPython.noop),
    ]
