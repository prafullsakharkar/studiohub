"""
No overlapping bookings for a resource, enforced by the database (docs/scheduling/CONTRACTS.md
DOM-SCH-04, decision Q32).

Adds an exclusion constraint on ``(resource, tstzrange(start_time, end_time, '[)'))`` for live
bookings whose status occupies the resource (Booked, Blocked, Overbooked). Backs the check
``BookingService`` already makes under a row lock, so a write that bypasses the service (the admin,
raw SQL) cannot overlap either. PostgreSQL only: other engines get no SQL and keep the service
check. The constraint needs the ``btree_gist`` extension, created here when it is missing (masterdata
creates it too); reversing leaves it installed.

Refuses, changing nothing, while overlapping pairs already exist, and lists them (up to 50): fix or
remove one booking of each pair (move it, or delete it), then migrate again. Pairs are counted by
query S1 of docs/delivery-pipeline/ANALYSIS.md section 8 (which also counts Available slots; they
never conflict and are not listed here).
"""

import apps.masterdata.constraints
import apps.masterdata.operations
import django.contrib.postgres.fields.ranges
from django.db import migrations, models

LIMIT = 50

#: pairs of live bookings of one resource, both occupying it, that share some time
OVERLAPPING_PAIRS = """
    SELECT a.id, b.id, r.code, a.start_time, a.end_time, b.start_time, b.end_time
    FROM scheduling_resource_schedule a
    JOIN scheduling_resource_schedule b
      ON a.resource_id = b.resource_id AND a.id < b.id
     AND a.start_time < b.end_time AND b.start_time < a.end_time
    JOIN scheduling_resource r ON r.id = a.resource_id
    WHERE NOT a.is_deleted AND NOT b.is_deleted
      AND a.status IN ('Booked', 'Blocked', 'Overbooked')
      AND b.status IN ('Booked', 'Blocked', 'Overbooked')
    ORDER BY r.code, a.start_time, a.id
    LIMIT %s
"""


def refuse_overlapping_bookings(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(OVERLAPPING_PAIRS, [LIMIT + 1])
        rows = cursor.fetchall()
    if not rows:
        return
    lines = [
        f"resource {code}: booking {first} ({a_start:%Y-%m-%d %H:%M} to {a_end:%H:%M} UTC) "
        f"overlaps booking {second} ({b_start:%Y-%m-%d %H:%M} to {b_end:%H:%M} UTC)"
        for first, second, code, a_start, a_end, b_start, b_end in rows[:LIMIT]
    ]
    more = " (and more)" if len(rows) > LIMIT else ""
    raise RuntimeError(
        "scheduling 0008 stopped, nothing was changed. Move or delete one booking of each pair, "
        "then migrate again:\n  " + "\n  ".join(lines) + more
    )


class Migration(migrations.Migration):
    dependencies = [
        ("scheduling", "0007_milestone"),
    ]

    operations = [
        migrations.RunPython(refuse_overlapping_bookings, migrations.RunPython.noop),
        apps.masterdata.operations.EnsureBtreeGistExtension(),
        migrations.AddConstraint(
            model_name="resourceschedule",
            constraint=apps.masterdata.constraints.PostgresOnlyExclusionConstraint(
                condition=models.Q(
                    ("is_deleted", False), ("status__in", ("Booked", "Blocked", "Overbooked"))
                ),
                expressions=[
                    (models.F("resource"), "="),
                    (
                        models.Func(
                            models.F("start_time"),
                            models.F("end_time"),
                            models.Value("[)"),
                            function="tstzrange",
                            output_field=django.contrib.postgres.fields.ranges.DateTimeRangeField(),
                        ),
                        "&&",
                    ),
                ],
                name="scheduling_booking_no_overlap",
            ),
        ),
    ]
