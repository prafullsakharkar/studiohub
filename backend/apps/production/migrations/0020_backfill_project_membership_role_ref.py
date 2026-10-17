"""Backfill ProjectMembership.role_ref by role-code match (N7).

Obsolete since the organization removal plan: the backfill matched the
legacy ``role`` Char against organization-scoped ``Role`` rows, which no
longer exist. ``role_ref`` is re-pointed to ``identity.Role`` by migration
0022, and identity-side seeding populates it. Kept as a documented no-op so
fresh-DB migrations never touch the deleted organization app.
"""

from django.db import migrations


def backfill_project_membership_roles(apps, schema_editor):  # noqa: ARG001
    # Organization removal (B7): the source ``organization.Role`` rows are
    # gone, so this data backfill has nothing to run against. No-op.
    return None


class Migration(migrations.Migration):

    dependencies = [
        ("production", "0019_projectmembership_role_ref"),
    ]

    operations = [
        migrations.RunPython(
            backfill_project_membership_roles, migrations.RunPython.noop
        ),
    ]
