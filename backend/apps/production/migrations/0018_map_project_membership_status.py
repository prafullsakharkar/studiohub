"""Map legacy ProjectMembership.status to canonical choices (N2).

Case-insensitive match on active/on_leave/terminated/suspended; anything
else becomes "active". Idempotent, reports counts.
"""

from django.db import migrations

CANONICAL = {"active", "on_leave", "terminated", "suspended"}


def backfill_project_membership_statuses(apps, schema_editor):
    ProjectMembership = apps.get_model("production", "ProjectMembership")
    mapped, defaulted = 0, 0
    for membership in ProjectMembership.objects.all().only("id", "status"):
        normalized = (membership.status or "").strip().lower()
        if normalized in CANONICAL:
            if normalized != membership.status:
                membership.status = normalized
                membership.save(update_fields=["status"])
                mapped += 1
        else:
            membership.status = "active"
            membership.save(update_fields=["status"])
            defaulted += 1
    print(
        "project_membership status map: "
        f"mapped={mapped} defaulted={defaulted}"
    )


class Migration(migrations.Migration):

    dependencies = [
        ("production", "0017_alter_projectmembership_status"),
    ]

    operations = [
        migrations.RunPython(
            backfill_project_membership_statuses, migrations.RunPython.noop
        ),
    ]
