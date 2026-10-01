"""Drop legacy drift columns on organizations.

The live database carries ``banner_url`` and ``logo_url`` NOT NULL columns
on ``organizations`` that exist in no model and in no migration (manual
schema drift). Nothing reads or writes them, but PostgreSQL rejects every
ORM INSERT missing them, so organization creation always 500/409s.

``headquarters_office_id`` / ``primary_supervisor_id`` are left untouched:
they are nullable (do not block inserts) and one row holds a real office
reference worth preserving until a modeled home exists.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        # NOTE: on-disk leaf is 0019; 0020-0023 exist only in DB history
        # (files removed during an earlier cleanup, operations live).
        ("organization", "0019_normalize_organization_status"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "ALTER TABLE organizations "
                "DROP COLUMN IF EXISTS banner_url, "
                "DROP COLUMN IF EXISTS logo_url;"
            ),
            reverse_sql=(
                "ALTER TABLE organizations "
                "ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500), "
                "ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);"
            ),
        ),
    ]
