"""
CR-60: bring every project's client and vendors in line with the records that already name them.

For each project:

* ``client_id`` is resolved to a live client, by UUID or by code ignoring case, and stored as its UUID with
  ``client_name`` filled in. A project with no client gets one only when its deliveries and members all name
  the same single client; with two or more different clients it is left blank for a person to choose.
* ``vendor_ids`` gains, after the ones already there, the live vendors its tasks and members name (by UUID or
  by code ignoring case).

Values that name no live client or vendor are left as they are and counted in the output. Nothing is removed,
and records are never rewritten. Not reversed: the ids it adds are ordinary data.
"""

from __future__ import annotations

from uuid import UUID

from django.db import migrations


def _uuid_text(value):
    try:
        return str(UUID(str(value).strip()))
    except (TypeError, ValueError, AttributeError):
        return None


class _Partners:
    """Live clients or vendors, looked up by UUID or by code (ignoring case)."""

    def __init__(self, model):
        rows = list(model._base_manager.filter(is_deleted=False).values_list("pk", "code", "name"))
        self.by_id = {str(pk): (str(pk), name) for pk, _code, name in rows}
        self.by_code = {code.lower(): (str(pk), name) for pk, code, name in rows if code}

    def find(self, value):
        value = str(value or "").strip()
        if not value:
            return None
        pk = _uuid_text(value)
        return self.by_id.get(pk) if pk else self.by_code.get(value.lower())


def bring_in_line(apps, schema_editor):
    Project = apps.get_model("production", "Project")
    Task = apps.get_model("production", "Task")
    Membership = apps.get_model("production", "ProjectMembership")
    Delivery = apps.get_model("deliveries", "DeliveryPackage")
    clients = _Partners(apps.get_model("masterdata", "Client"))
    vendors = _Partners(apps.get_model("masterdata", "Vendor"))
    unresolved = ambiguous = 0

    for project in Project._base_manager.filter(is_deleted=False).iterator():
        changed = []
        members = list(
            Membership._base_manager.filter(project_id=project.pk, is_deleted=False).values_list(
                "client_id", "vendor_id"
            )
        )

        stored = str(project.client_id or "").strip()
        if stored:
            found = clients.find(stored)
            if found is None:
                unresolved += 1
            elif (found[0], found[1]) != (project.client_id, project.client_name):
                project.client_id, project.client_name = found
                changed += ["client_id", "client_name"]
        else:
            named = {
                str(pk)
                for pk in Delivery._base_manager.filter(project_id=project.pk, is_deleted=False)
                .exclude(client_id=None)
                .values_list("client_id", flat=True)
            }
            for client_ref, _vendor_ref in members:
                found = clients.find(client_ref)
                if found is not None:
                    named.add(found[0])
                elif str(client_ref or "").strip():
                    unresolved += 1
            if len(named) == 1:
                found = clients.find(named.pop())
                if found is not None:
                    project.client_id, project.client_name = found
                    changed += ["client_id", "client_name"]
            elif len(named) > 1:
                ambiguous += 1

        listed = [str(v) for v in (project.vendor_ids or [])]
        seen = {_uuid_text(v) for v in listed}
        refs = [
            ref
            for pair in Task._base_manager.filter(
                project_id=project.pk, is_deleted=False
            ).values_list("vendor_id", "vendor_code")
            for ref in pair
        ] + [vendor_ref for _client_ref, vendor_ref in members]
        added = []
        for ref in refs:
            found = vendors.find(ref)
            if found is None:
                continue
            if found[0] not in seen:
                seen.add(found[0])
                added.append(found[0])
        if added:
            project.vendor_ids = listed + sorted(added)
            changed.append("vendor_ids")

        if changed:
            project.save(update_fields=changed)

    if unresolved or ambiguous:
        print(
            f"\n  CR-60: {unresolved} client value(s) name no live client and were left as they are; "
            f"{ambiguous} project(s) have records naming more than one client, so their client was left blank."
        )


class Migration(migrations.Migration):
    dependencies = [
        ("production", "0018_rp25_review_slates"),
        ("deliveries", "0003_qc_item_set_null"),
        ("masterdata", "0002_team_membership"),
    ]

    operations = [
        migrations.RunPython(bring_in_line, migrations.RunPython.noop),
    ]
