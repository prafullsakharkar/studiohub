"""Adopt drift settings columns on organization settings.

The live database carries eight NOT NULL columns on
``organization_organization_settings`` (pipeline/security defaults the
frontend already reads) that exist in no model and in no migration, so
bare creates — e.g. tenant provisioning on organization create —
fail with IntegrityError (surfaced as 409).

The model fields (with matching types/defaults) were added alongside;
this migration converges state on all environments and is a no-op
where the columns already exist.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organization", "0024_drop_legacy_org_columns"),
    ]

    database_operations = [
        migrations.RunSQL(
            sql=(
                "ALTER TABLE organization_organization_settings "
                "ADD COLUMN IF NOT EXISTS allow_guest_reviewers BOOLEAN NOT NULL DEFAULT FALSE, "
                "ADD COLUMN IF NOT EXISTS enable_two_factor BOOLEAN NOT NULL DEFAULT FALSE, "
                "ADD COLUMN IF NOT EXISTS sso_enforced BOOLEAN NOT NULL DEFAULT FALSE, "
                "ADD COLUMN IF NOT EXISTS default_fps DOUBLE PRECISION NOT NULL DEFAULT 24.0, "
                "ADD COLUMN IF NOT EXISTS default_color_space VARCHAR(64) NOT NULL DEFAULT 'ACEScg', "
                "ADD COLUMN IF NOT EXISTS default_resolution VARCHAR(64) NOT NULL DEFAULT '1920x1080', "
                "ADD COLUMN IF NOT EXISTS usd_schema_version VARCHAR(64) NOT NULL DEFAULT '24.08', "
                "ADD COLUMN IF NOT EXISTS render_farm_region VARCHAR(255) NOT NULL DEFAULT '';"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]

    state_operations = [
        migrations.AddField(
            model_name="organizationsettings",
            name="allow_guest_reviewers",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="organizationsettings",
            name="enable_two_factor",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="organizationsettings",
            name="sso_enforced",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="organizationsettings",
            name="default_fps",
            field=models.FloatField(default=24.0),
        ),
        migrations.AddField(
            model_name="organizationsettings",
            name="default_color_space",
            field=models.CharField(default="ACEScg", max_length=64),
        ),
        migrations.AddField(
            model_name="organizationsettings",
            name="default_resolution",
            field=models.CharField(blank=True, default="1920x1080", max_length=64),
        ),
        migrations.AddField(
            model_name="organizationsettings",
            name="usd_schema_version",
            field=models.CharField(blank=True, default="24.08", max_length=64),
        ),
        migrations.AddField(
            model_name="organizationsettings",
            name="render_farm_region",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=database_operations,
            state_operations=state_operations,
        )
    ]
