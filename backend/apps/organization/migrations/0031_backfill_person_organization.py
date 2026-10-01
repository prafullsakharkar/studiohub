"""Backfill legacy Person.organization.

Legacy seed rows carry ``organization=NULL``; org-scoped reads are
fail-closed, so those people are invisible to every tenant — no Person
detail/people list/edit page can serve them. Assign them to the default
studio organization (and later tenants inherit none). Rows already
assigned are untouched; the migration is idempotent.
"""

from django.db import migrations


DEFAULT_ORG_CODE = "APEX"


def backfill(apps, schema_editor):
    Person = apps.get_model("organization", "Person")
    Organization = apps.get_model("organization", "Organization")
    org = Organization.objects.filter(code=DEFAULT_ORG_CODE).first() or (
        Organization.objects.order_by("created_at").first()
    )
    if org is None:
        return
    Person.objects.filter(organization__isnull=True).update(organization=org)


class Migration(migrations.Migration):

    dependencies = [
        (
            "organization",
            "0030_department_capacity_hours_weekly_department_color_and_more",
        ),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
