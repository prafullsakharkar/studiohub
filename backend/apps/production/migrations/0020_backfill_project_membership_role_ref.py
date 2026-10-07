"""Backfill ProjectMembership.role_ref by role-code match (N7).

Matches ``role`` Char (case-insensitive, stripped) against ``Role.code``
where the role is global (organization null) or belongs to the membership's
organization — own-org custom wins over global. No match leaves NULL with
the Char snapshot intact. Idempotent, reports counts.
"""

from django.db import migrations


def backfill_project_membership_roles(apps, schema_editor):
    ProjectMembership = apps.get_model("production", "ProjectMembership")
    Role = apps.get_model("organization", "Role")
    linked, unmatched = 0, 0
    for membership in ProjectMembership.objects.filter(role_ref__isnull=True).exclude(
        role=""
    ):
        code = (membership.role or "").strip()
        role = (
            Role.objects.filter(code__iexact=code, organization_id=membership.organization_id).first()
            or Role.objects.filter(
                code__iexact=code, organization__isnull=True
            ).first()
        )
        if role is None:
            unmatched += 1
            continue
        membership.role_ref = role
        membership.save(update_fields=["role_ref"])
        linked += 1
    print(f"project_membership role_ref backfill: linked={linked} unmatched={unmatched}")


class Migration(migrations.Migration):

    dependencies = [
        ("production", "0019_projectmembership_role_ref"),
    ]

    operations = [
        migrations.RunPython(
            backfill_project_membership_roles, migrations.RunPython.noop
        ),
    ]
