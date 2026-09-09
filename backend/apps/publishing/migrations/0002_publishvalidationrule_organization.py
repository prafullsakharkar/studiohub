"""
Add organization scoping to PublishValidationRule.

Validation rules have no creation path yet (API/seed), so existing rows can
only be legacy orphans: they are assigned to the first organization when one
exists, otherwise removed. The field is then made non-nullable.
"""

from django.db import migrations, models
import django.db.models.deletion


def assign_rules_to_first_organization(apps, schema_editor):
    """Backfill existing rules with the first organization, or drop them."""
    Organization = apps.get_model("organization", "Organization")
    PublishValidationRule = apps.get_model("publishing", "PublishValidationRule")

    organization = Organization.objects.filter(is_deleted=False).first()
    if organization is not None:
        PublishValidationRule.objects.filter(
            organization__isnull=True,
        ).update(organization=organization)
    else:
        PublishValidationRule.objects.filter(
            organization__isnull=True,
        ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("organization", "0001_initial"),
        ("publishing", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="publishvalidationrule",
            name="organization",
            field=models.ForeignKey(
                db_index=True,
                help_text="Organization context",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="publish_validation_rules",
                to="organization.organization",
            ),
        ),
        migrations.RunPython(
            assign_rules_to_first_organization,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="publishvalidationrule",
            name="organization",
            field=models.ForeignKey(
                db_index=True,
                help_text="Organization context",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="publish_validation_rules",
                to="organization.organization",
            ),
        ),
    ]
