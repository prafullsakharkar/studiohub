"""Adopt drift FK column headquarters_office on organizations.

The live database carries ``headquarters_office_id`` (UUID, nullable)
with a real office reference on at least one tenant, but no model and no
migration knew it — so the frontend's HQ location selector could neither
save nor reload the value. The ``headquarters_office`` FK adopts the
existing column (preserving data); no-op where it already exists.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organization", "0026_person_role_position_scope_state"),
    ]

    state_operations = [
        migrations.AddField(
            model_name="organization",
            name="headquarters_office",
            field=models.ForeignKey(
                blank=True,
                help_text="Office backing the headquarters location selector.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="headquartered_organizations",
                to="organization.office",
                verbose_name="Headquarters Office",
            ),
        ),
    ]

    database_operations = [
        migrations.RunSQL(
            sql=(
                "ALTER TABLE organizations "
                "ADD COLUMN IF NOT EXISTS headquarters_office_id UUID "
                "REFERENCES org_office(id) ON DELETE SET NULL;"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=database_operations,
            state_operations=state_operations,
        )
    ]
