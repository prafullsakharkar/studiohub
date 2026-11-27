"""
A project's client and vendors, and the records that may name them (docs/sync CR-60).

A project has one client (``Project.client_id``, a live client's UUID, with ``client_name`` the server's) and a
list of vendors (``Project.vendor_ids``, CR-42). On that project:

* a delivery's client must be the project's client;
* a task's vendor must be one of the project's vendors (the server fills the task's vendor name and code);
* a member's client must be the project's client, and a member's vendor one of its vendors.

A member's client or vendor makes them external (``selectors/external_scope.py``), so these are checked on the
server, not only in the pickers. Changing the project's client, or taking a vendor off it, is refused while a
record of the project still names the old one. Stored values are matched by UUID or by code, ignoring case,
because older rows hold either.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any
from uuid import UUID

from django.apps import apps
from django.db.models import Q
from rest_framework.exceptions import ValidationError

UNKNOWN_CLIENT = "Unknown client."
NOT_PROJECT_CLIENT = "This client is not the project's client."
NOT_PROJECT_VENDOR = "This vendor is not on the project."


def _uuid_text(value: Any) -> str | None:
    """``value`` as a canonical UUID string, or None when it is not one."""
    try:
        return str(UUID(str(value).strip()))
    except (TypeError, ValueError, AttributeError):
        return None


def _client_model():
    return apps.get_model("masterdata", "Client")


def _vendor_model():
    return apps.get_model("masterdata", "Vendor")


def resolve_project_client(value: Any) -> tuple[str, str]:
    """
    A project's ``client_id`` as written: ``("", "")`` for blank, else the live client's ``(uuid, name)``.

    Raises a ``ValidationError`` on ``client_id`` for anything that names no live client (a code included:
    the project stores the UUID).
    """
    if value is None or not str(value).strip():
        return "", ""
    pk = _uuid_text(value)
    client = _client_model().objects.filter(pk=pk, is_deleted=False).first() if pk else None
    if client is None:
        raise ValidationError({"client_id": [UNKNOWN_CLIENT]})
    return str(client.pk), client.name


def _same(stored: Any, wanted: str) -> bool:
    return bool(wanted) and _uuid_text(stored) == wanted


def require_project_client(project: Any, client_id: Any, *, field: str = "client_id") -> str:
    """The client's UUID when it is the project's client; otherwise a ``ValidationError`` on ``field``."""
    wanted = _uuid_text(client_id)
    if wanted is None or not _same(project.client_id, wanted):
        raise ValidationError({field: [NOT_PROJECT_CLIENT]})
    return wanted


def require_project_vendor(project: Any, vendor_id: Any, *, field: str = "vendor_id"):
    """The live vendor when it is one of the project's vendors; otherwise a ``ValidationError`` on ``field``."""
    wanted = _uuid_text(vendor_id)
    listed = {_uuid_text(v) for v in (project.vendor_ids or [])}
    vendor = (
        _vendor_model().objects.filter(pk=wanted, is_deleted=False).first()
        if wanted and wanted in listed
        else None
    )
    if vendor is None:
        raise ValidationError({field: [NOT_PROJECT_VENDOR]})
    return vendor


# ---------------------------------------------------------------------------
# Changing the project's client, or taking a vendor off it
# ---------------------------------------------------------------------------


def _matches(field: str, values: Iterable[str]) -> Q:
    q = Q(pk__in=[])
    for value in values:
        if value:
            q |= Q(**{f"{field}__iexact": value})
    return q


def _find(model, value: str):
    """The row ``value`` names, by UUID or by code ignoring case, soft-deleted included (older rows hold either)."""
    pk = _uuid_text(value)
    rows = model.all_objects
    return rows.filter(pk=pk).first() if pk else rows.filter(code__iexact=value).first()


def _counted(count: int, one: str, many: str) -> str:
    return f"{count} {one if count == 1 else many}"


def _sentence(name: str, role: str, parts: list[str]) -> str:
    joined = parts[0] if len(parts) == 1 else f"{', '.join(parts[:-1])} and {parts[-1]}"
    return f"{name} is still the {role} of {joined}."


def _client_in_use(project: Any, old: str) -> str | None:
    client = _find(_client_model(), old)
    refs = [old] + ([str(client.pk), client.code] if client is not None else [])
    deliveries = apps.get_model("deliveries", "DeliveryPackage").objects.filter(
        project=project, is_deleted=False
    )
    delivery_count = deliveries.filter(client_id__in=[r for r in refs if _uuid_text(r)]).count()
    member_count = (
        apps.get_model("production", "ProjectMembership")
        .objects.filter(project=project, is_deleted=False)
        .filter(_matches("client_id", refs))
        .count()
    )
    parts = []
    if delivery_count:
        parts.append(_counted(delivery_count, "delivery", "deliveries"))
    if member_count:
        parts.append(_counted(member_count, "member", "members"))
    if not parts:
        return None
    return _sentence(
        client.name if client is not None else (project.client_name or old), "client", parts
    )


def _vendor_in_use(project: Any, vendor_id: str) -> str | None:
    vendor = _find(_vendor_model(), vendor_id)
    refs = [vendor_id] + ([str(vendor.pk), vendor.code] if vendor is not None else [])
    task_count = (
        apps.get_model("production", "Task")
        .objects.filter(project=project, is_deleted=False)
        .filter(_matches("vendor_id", refs) | _matches("vendor_code", refs))
        .count()
    )
    member_count = (
        apps.get_model("production", "ProjectMembership")
        .objects.filter(project=project, is_deleted=False)
        .filter(_matches("vendor_id", refs))
        .count()
    )
    parts = []
    if task_count:
        parts.append(_counted(task_count, "task", "tasks"))
    if member_count:
        parts.append(_counted(member_count, "member", "members"))
    if not parts:
        return None
    return _sentence(vendor.name if vendor is not None else vendor_id, "vendor", parts)


def refuse_partners_in_use(project: Any, data: dict[str, Any]) -> None:
    """
    A ``ValidationError`` when ``data`` changes or clears the project's client, or drops a vendor, that a
    delivery, task or member of the project still names. Records are never rewritten.
    """
    errors: dict[str, list[str]] = {}
    if "client_id" in data:
        old = str(project.client_id or "").strip()
        if old and _uuid_text(data["client_id"]) != _uuid_text(old):
            message = _client_in_use(project, old)
            if message:
                errors["client_id"] = [message]
    if "vendor_ids" in data:
        kept = {_uuid_text(v) for v in (data["vendor_ids"] or [])}
        messages = [
            message
            for vendor_id in (project.vendor_ids or [])
            if _uuid_text(vendor_id) not in kept
            and (message := _vendor_in_use(project, str(vendor_id)))
        ]
        if messages:
            errors["vendor_ids"] = messages
    if errors:
        raise ValidationError(errors)
