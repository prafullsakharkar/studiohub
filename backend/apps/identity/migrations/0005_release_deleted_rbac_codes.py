"""
CR-59: free the codes of roles and groups deleted before deleting released them.

A deleted role or group kept its code, and the code is unique across every row, so it could never
be used again. ``RoleService.delete`` and ``GroupService.delete`` now rename it to
``<code>--deleted-<first 8 of the id>``; this does the same for the rows already deleted. Nothing
looks a deleted row up by its code. Not reversed: the original codes are not kept.
"""

from __future__ import annotations

from django.db import migrations

MARK = "--deleted-"


def release(apps, schema_editor):
    for name in ("Role", "Group"):
        model = apps.get_model("identity", name)
        max_length = model._meta.get_field("code").max_length
        for row in model._base_manager.filter(is_deleted=True).exclude(code__contains=MARK):
            suffix = f"{MARK}{str(row.pk).replace('-', '')[:8]}"
            row.code = f"{row.code[: max_length - len(suffix)]}{suffix}"
            row.save(update_fields=["code"])


class Migration(migrations.Migration):
    dependencies = [
        ("identity", "0004_directory_tls_options"),
    ]

    operations = [
        migrations.RunPython(release, migrations.RunPython.noop),
    ]
