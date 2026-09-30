"""
Data migration: normalize legacy Organization.status values.

Older frontend builds wrote invented statuses (``Onboarding``,
``Suspended``, ``Maintenance``) through an un-validated update path, and
direct DB seeds inserted Title Case values (``Active``). The canonical
vocabulary is ``LifecycleStatus`` (``draft``/``active``/``inactive``/
``archived``, stored lowercase). This migration lowercases any
known-but-wrong-case value and maps anything still outside the canonical
set to ``active`` (the default for a live tenant).
"""

from django.db import migrations
from django.db.models.functions import Lower

# Hardcoded (not imported from apps) so the migration stays frozen against
# future changes to LifecycleStatus.
VALID_STATUSES = ("draft", "active", "inactive", "archived")
DEFAULT_STATUS = "active"


def normalize_organization_statuses(apps, schema_editor):
    Organization = apps.get_model("organization", "Organization")

    # 1. Lowercase any known-but-wrong-case value ('Active' -> 'active').
    Organization.objects.exclude(status__in=VALID_STATUSES).update(status=Lower("status"))

    # 2. Anything still outside the canonical set ('onboarding', '') -> 'active'.
    Organization.objects.exclude(status__in=VALID_STATUSES).update(status=DEFAULT_STATUS)


class Migration(migrations.Migration):
    dependencies = [
        ("organization", "0018_alter_role_scope"),
    ]

    operations = [
        migrations.RunPython(normalize_organization_statuses, migrations.RunPython.noop),
    ]
