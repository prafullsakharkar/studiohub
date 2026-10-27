"""
Holidays belong to a work calendar (docs/scheduling/CONTRACTS.md DOM-SCH-02, decision Q21).

Adds ``Holiday.calendar`` (PROTECT), attaches every existing holiday, soft-deleted ones included, to
the default calendar, makes the link mandatory and replaces the studio-wide "one holiday per date"
rule with one per calendar and date among live holidays.

Additive in effect: every existing holiday keeps meaning "a holiday of the studio". The reverse
restores the old rule and fails if two calendars hold a holiday on the same date, which is the only
way back to a single studio list.
"""

import django.db.models.deletion
from django.db import migrations, models


def attach_holidays_to_the_default_calendar(apps, schema_editor):
    WorkCalendar = apps.get_model("scheduling", "WorkCalendar")
    Holiday = apps.get_model("scheduling", "Holiday")
    default = WorkCalendar._base_manager.filter(is_default=True, is_deleted=False).first()
    if default is None:
        default = WorkCalendar._base_manager.get_or_create(
            code="STUDIO",
            defaults={
                "name": "Studio",
                "time_zone": "UTC",
                "working_weekdays": [1, 2, 3, 4, 5],
                "hours_per_day": 8,
                "is_default": True,
            },
        )[0]
    Holiday._base_manager.filter(calendar__isnull=True).update(calendar=default)


class Migration(migrations.Migration):
    dependencies = [
        ("scheduling", "0004_work_calendar"),
    ]

    operations = [
        migrations.AddField(
            model_name="holiday",
            name="calendar",
            field=models.ForeignKey(
                help_text="The work calendar this holiday belongs to",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="holidays",
                to="scheduling.workcalendar",
            ),
        ),
        migrations.RunPython(attach_holidays_to_the_default_calendar, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="holiday",
            name="calendar",
            field=models.ForeignKey(
                help_text="The work calendar this holiday belongs to",
                on_delete=django.db.models.deletion.PROTECT,
                related_name="holidays",
                to="scheduling.workcalendar",
            ),
        ),
        migrations.AlterUniqueTogether(
            name="holiday",
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name="holiday",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_deleted", False)),
                fields=("calendar", "holiday_date"),
                name="scheduling_holiday_calendar_date_live_uniq",
            ),
        ),
    ]
