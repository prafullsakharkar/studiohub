"""Fix pre-existing model/migration drift (predates N-phase).

``Group.code`` is declared globally unique in the model, but applied
migrations only enforced per-org uniqueness — duplicate codes exist, so the
pending unique index cannot build. Suffix later duplicates (``CODE`` ->
``CODE_<ORGCODE>``) preserving every row, then drop the superseded per-org
constraints. Idempotent.

The per-org drops are defensive: some databases recorded 0033 without the
constraints existing. Introspection-guarded, portable across vendors.
"""

import django.db.models.deletion
from django.db import migrations, models


def dedupe_group_codes(apps, schema_editor):
    Group = apps.get_model("organization", "Group")
    Organization = apps.get_model("organization", "Organization")
    seen = {}
    renamed = 0
    for group in Group.objects.order_by("created_at", "id").only(
        "id", "code", "organization"
    ):
        if group.code in seen:
            org = None
            if group.organization_id:
                org = (
                    Organization.objects.filter(id=group.organization_id)
                    .only("code")
                    .first()
                )
            suffix = org.code if org else "GLOBAL"
            candidate = f"{group.code}_{suffix}"
            counter = 2
            while Group.objects.filter(code=candidate).exists():
                candidate = f"{group.code}_{suffix}_{counter}"
                counter += 1
            group.code = candidate[:100]
            group.save(update_fields=["code"])
            renamed += 1
        else:
            seen[group.code] = group.id
    print(f"group code dedupe: renamed={renamed}")


def drop_constraint_if_exists(apps, schema_editor, table, name):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        existing = schema_editor.connection.introspection.get_constraints(
            cursor, table
        )
    if name in existing:
        schema_editor.execute(f'ALTER TABLE "{table}" DROP CONSTRAINT "{name}"')


def drop_superseded_constraints(apps, schema_editor):
    drop_constraint_if_exists(
        apps, schema_editor, "organization_group", "uq_group_org_code"
    )
    drop_constraint_if_exists(
        apps, schema_editor, "organization_position", "uq_position_org_code"
    )


def ensure_unique_group_code(apps, schema_editor):
    """Create the global unique index on Group.code if no unique on (code) exists.

    Sibling of the drift above: databases that recorded 0033 without applying
    it may already carry the index. Introspection-guarded; no-op off Postgres
    (fresh non-Postgres builds derive schema from model state).
    """
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        existing = schema_editor.connection.introspection.get_constraints(
            cursor, "organization_group"
        )
    for info in existing.values():
        if info.get("unique") and list(info.get("columns") or []) == ["code"]:
            return
    schema_editor.execute(
        'CREATE UNIQUE INDEX "uq_organization_group_code" '
        'ON "organization_group" ("code")'
    )


class Migration(migrations.Migration):

    dependencies = [
        ("organization", "0033_group_position_org_code_unique"),
    ]

    operations = [
        migrations.RunPython(dedupe_group_codes, migrations.RunPython.noop),
        migrations.RunPython(
            drop_superseded_constraints, migrations.RunPython.noop
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RemoveConstraint(
                    model_name="group",
                    name="uq_group_org_code",
                ),
                migrations.RemoveConstraint(
                    model_name="position",
                    name="uq_position_org_code",
                ),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    ensure_unique_group_code, migrations.RunPython.noop
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name="group",
                    name="code",
                    field=models.CharField(max_length=100, unique=True),
                ),
            ],
        ),
    ]
