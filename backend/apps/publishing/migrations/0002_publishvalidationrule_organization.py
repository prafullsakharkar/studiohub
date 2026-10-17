"""
Add organization scoping to PublishValidationRule.

Validation rules have no creation path yet (API/seed), so existing rows can
only be legacy orphans: they are assigned to the first organization when one
exists, otherwise removed. The field is then made non-nullable.
"""

from django.db import migrations, models
import django.db.models.deletion


def assign_rules_to_first_organization(apps, schema_editor):  # noqa: ARG001
    """Backfill existing rules with the first organization, or drop them.

    Obsolete since the organization removal plan: the organization app is
    deleted and the ``organization`` field is removed by migration 0005.
    Kept as a documented no-op so fresh-DB migrations never touch the
    deleted organization app.
    """
    return None


class Migration(migrations.Migration):

    dependencies = [
        ("publishing", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="publishvalidationrule",
            name="organization",
            field=models.IntegerField(
                db_column="organization_id",
                db_index=True,
                help_text="Organization context",
                null=True,
            ),
        ),
        migrations.RunPython(
            assign_rules_to_first_organization,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="publishvalidationrule",
            name="organization",
            field=models.IntegerField(
                db_column="organization_id",
                db_index=True,
                help_text="Organization context",
            ),
        ),
    ]
