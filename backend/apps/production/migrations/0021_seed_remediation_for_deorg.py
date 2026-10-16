"""Pre-removal remediation for databases carrying pre-removal seed rows.

The department/team/role_ref FKs are re-pointed at the global
masterdata/identity tables (empty in existing environments), so orphan
references are nulled first (all three are nullable with SET_NULL
semantics). Duplicate project codes (repeated seed runs) are suffixed so
the new global ``code`` unique constraint applies cleanly. No-op on fresh
databases.

Kept as a standalone migration (ahead of the schema alter) so the UPDATEs
commit before any DDL touches the same tables — Postgres refuses to ALTER
a table with pending trigger events in the same transaction.
"""

from django.db import migrations


def remediate_seed_rows_for_deorg(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "UPDATE production_asset SET department_id = NULL"
            " WHERE department_id IS NOT NULL"
            " AND NOT EXISTS (SELECT 1 FROM masterdata_department"
            " WHERE masterdata_department.id = production_asset.department_id)"
        )
        cursor.execute(
            "UPDATE production_asset SET team_id = NULL"
            " WHERE team_id IS NOT NULL"
            " AND NOT EXISTS (SELECT 1 FROM masterdata_team"
            " WHERE masterdata_team.id = production_asset.team_id)"
        )
        cursor.execute(
            "UPDATE production_task SET team_id = NULL"
            " WHERE team_id IS NOT NULL"
            " AND NOT EXISTS (SELECT 1 FROM masterdata_team"
            " WHERE masterdata_team.id = production_task.team_id)"
        )
        cursor.execute(
            "UPDATE production_project_membership SET role_ref_id = NULL"
            " WHERE role_ref_id IS NOT NULL"
            " AND NOT EXISTS (SELECT 1 FROM identity_role"
            " WHERE identity_role.id = production_project_membership.role_ref_id)"
        )
        cursor.execute(
            "SELECT id, code FROM production_project ORDER BY id"
        )
        seen = {}
        dupes = []
        for row_id, code in cursor.fetchall():
            if code in seen:
                dupes.append((row_id, code))
            else:
                seen[code] = row_id
        for index, (row_id, code) in enumerate(dupes, start=1):
            cursor.execute(
                "UPDATE production_project SET code = %s WHERE id = %s",
                [f"{code}-SEED{index}", row_id],
            )


class Migration(migrations.Migration):

    dependencies = [
        ("production", "0020_backfill_project_membership_role_ref"),
    ]

    operations = [
        migrations.RunPython(
            remediate_seed_rows_for_deorg,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
