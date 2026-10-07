# N1 consolidation: Person.user FK + uniqueness (person-only; group drift
# fixed separately in 0034). The AddField is introspection-guarded because
# long-lived databases may already carry the column outside migration state.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def ensure_person_user_column(apps, schema_editor):
    # NOTE: database_operations see pre-state, so the field is defined inline
    # (migrations must not import live model state). Mirrors Person.user.
    field = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.deletion.SET_NULL,
        related_name="person_profiles",
        null=True,
        blank=True,
        db_index=True,
        help_text="Linked auth identity (N1 consolidation).",
    )
    field.set_attributes_from_name("user")
    with schema_editor.connection.cursor() as cursor:
        columns = {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(
                cursor, "organization_person"
            )
        }
    if field.column in columns:
        return
    schema_editor.add_field(apps.get_model("organization", "Person"), field)


def ensure_person_user_constraint(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        existing = schema_editor.connection.introspection.get_constraints(
            cursor, "organization_person"
        )
    if "uq_person_user_organization" in existing:
        return
    Person = apps.get_model("organization", "Person")
    schema_editor.add_constraint(
        Person,
        models.UniqueConstraint(
            fields=("user", "organization"), name="uq_person_user_organization"
        ),
    )


class Migration(migrations.Migration):

    dependencies = [
        ("organization", "0034_fix_group_code_drift"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    ensure_person_user_column, migrations.RunPython.noop
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="person",
                    name="user",
                    field=models.ForeignKey(
                        blank=True,
                        help_text="Linked auth identity (N1 consolidation).",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="person_profiles",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    ensure_person_user_constraint, migrations.RunPython.noop
                ),
            ],
            state_operations=[
                migrations.AddConstraint(
                    model_name="person",
                    constraint=models.UniqueConstraint(
                        fields=("user", "organization"),
                        name="uq_person_user_organization",
                    ),
                ),
            ],
        ),
    ]
