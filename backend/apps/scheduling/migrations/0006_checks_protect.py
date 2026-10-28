"""
Integrity checks and history protection (docs/scheduling/CONTRACTS.md DOM-SCH-03, 04, 05, 07,
decision Q24).

* Database checks: an event's end is not before its start, a booking ends after it starts, a leave
  ends on or after its first day, a resource's rate is not negative.
* A resource code is unique in any case (the column stays unique as typed).
* Bookings and leave can no longer be deleted along with their resource, and an event keeps its
  project: ``PROTECT`` (no SQL).

Refuses, changing nothing, while rows exist that would break a check or the code rule, and lists
them (up to 50 of each kind). Fix or remove them, then migrate again. Deleted rows are included:
the checks apply to every row. The read-only counts are query S2 of
docs/delivery-pipeline/ANALYSIS.md section 8. The reverse removes the checks.
"""

import django.db.models.deletion
import django.db.models.functions.text
from django.db import migrations, models
from django.db.models import Count, F
from django.db.models.functions import Upper

LIMIT = 50


def _ids(queryset):
    rows = list(queryset.values_list("id", flat=True)[: LIMIT + 1])
    more = " (and more)" if len(rows) > LIMIT else ""
    return ", ".join(str(pk) for pk in rows[:LIMIT]) + more


def refuse_rows_that_break_the_checks(apps, schema_editor):
    Event = apps.get_model("scheduling", "CalendarEvent")
    Booking = apps.get_model("scheduling", "ResourceSchedule")
    Leave = apps.get_model("scheduling", "ResourceLeave")
    Resource = apps.get_model("scheduling", "Resource")

    problems = []
    bad = Event._base_manager.filter(end_time__lt=F("start_time"))
    if bad.exists():
        problems.append(f"events that end before they start: {_ids(bad)}")
    bad = Booking._base_manager.filter(end_time__lte=F("start_time"))
    if bad.exists():
        problems.append(f"bookings that do not end after they start: {_ids(bad)}")
    bad = Leave._base_manager.filter(end_date__lt=F("start_date"))
    if bad.exists():
        problems.append(f"leave that ends before it starts: {_ids(bad)}")
    bad = Resource._base_manager.filter(hourly_rate_usd__lt=0)
    if bad.exists():
        problems.append(f"resources with a negative hourly rate: {_ids(bad)}")
    clashes = (
        Resource._base_manager.annotate(ucode=Upper("code"))
        .values("ucode")
        .annotate(n=Count("id"))
        .filter(n__gt=1)
        .order_by("ucode")
    )
    for entry in list(clashes)[:LIMIT]:
        rows = Resource._base_manager.annotate(ucode=Upper("code")).filter(ucode=entry["ucode"])
        problems.append(
            f"resource code {entry['ucode']} is used more than once: "
            + ", ".join(f"{row.id} ({row.code})" for row in rows)
        )
    if problems:
        raise RuntimeError(
            "scheduling 0006 stopped, nothing was changed. Fix or remove these rows, then "
            "migrate again:\n  " + "\n  ".join(problems)
        )


class Migration(migrations.Migration):
    dependencies = [
        ("scheduling", "0005_holiday_calendar"),
    ]

    operations = [
        migrations.RunPython(refuse_rows_that_break_the_checks, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="calendarevent",
            name="project",
            field=models.ForeignKey(
                blank=True,
                help_text="Associated project",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="calendar_events",
                to="production.project",
            ),
        ),
        migrations.AlterField(
            model_name="resourceleave",
            name="resource",
            field=models.ForeignKey(
                help_text="Resource requesting leave",
                on_delete=django.db.models.deletion.PROTECT,
                related_name="leaves",
                to="scheduling.resource",
            ),
        ),
        migrations.AlterField(
            model_name="resourceschedule",
            name="resource",
            field=models.ForeignKey(
                help_text="Booked resource",
                on_delete=django.db.models.deletion.PROTECT,
                related_name="schedules",
                to="scheduling.resource",
            ),
        ),
        migrations.AddConstraint(
            model_name="calendarevent",
            constraint=models.CheckConstraint(
                condition=models.Q(("end_time__gte", models.F("start_time"))),
                name="scheduling_event_end_not_before_start",
            ),
        ),
        migrations.AddConstraint(
            model_name="resourceleave",
            constraint=models.CheckConstraint(
                condition=models.Q(("end_date__gte", models.F("start_date"))),
                name="scheduling_leave_end_not_before_start",
            ),
        ),
        migrations.AddConstraint(
            model_name="resourceschedule",
            constraint=models.CheckConstraint(
                condition=models.Q(("end_time__gt", models.F("start_time"))),
                name="scheduling_booking_end_after_start",
            ),
        ),
        migrations.AddConstraint(
            model_name="resource",
            constraint=models.UniqueConstraint(
                django.db.models.functions.text.Upper("code"), name="scheduling_resource_ucode_uniq"
            ),
        ),
        migrations.AddConstraint(
            model_name="resource",
            constraint=models.CheckConstraint(
                condition=models.Q(("hourly_rate_usd__gte", 0)),
                name="scheduling_resource_rate_not_negative",
            ),
        ),
    ]
