"""
Storage root use cases (CONTRACTS DOM-PUB-01). Studio-wide; writes need ``publishing.storage.manage``.
"""

from __future__ import annotations

from typing import Any

from django.db import transaction
from django.db.models.functions import Upper
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.publishing.models import PublishedFile, StorageRoot
from apps.publishing.models.storage import ROOT_CODE_VALIDATOR
from apps.publishing.services import audit

_EDITABLE = ("name", "linux_path", "windows_path", "mac_path", "is_active")


class StorageRootService:
    @classmethod
    @transaction.atomic
    def create(cls, *, actor: Any, data: dict[str, Any]) -> StorageRoot:
        code = str(data.get("code") or "").strip()
        if not code:
            raise ValidationError({"code": ["A code is required."]})
        try:
            ROOT_CODE_VALIDATOR(code)
        except Exception as error:
            raise ValidationError({"code": [str(getattr(error, "message", error))]}) from error
        if len(code) > 50:
            raise ValidationError({"code": ["At most 50 characters."]})
        if StorageRoot.all_objects.annotate(u=Upper("code")).filter(u=code.upper()).exists():
            raise ValidationError({"code": ["This code is already used."]})
        root = StorageRoot.objects.create(
            code=code,
            created_by=actor if getattr(actor, "is_authenticated", False) else None,
            **{field: data[field] for field in _EDITABLE if field in data},
        )
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_CREATE,
            target_id=root.pk,
            target_name=root.code,
            description=f"Storage root {root.code} created",
        )
        return root

    @classmethod
    @transaction.atomic
    def update(cls, *, actor: Any, root: StorageRoot, data: dict[str, Any]) -> StorageRoot:
        locked = StorageRoot.objects.select_for_update().get(pk=root.pk)
        if "code" in data and str(data["code"]).upper() != locked.code.upper():
            raise ValidationError({"code": ["Cannot be changed: files refer to this code."]})
        changed = []
        for field in _EDITABLE:
            if field in data and getattr(locked, field) != data[field]:
                setattr(locked, field, data[field])
                changed.append(field)
        if changed:
            locked.updated_by = actor if getattr(actor, "is_authenticated", False) else None
            locked.save(update_fields=[*changed, "updated_by", "updated_at"])
            audit.record(
                actor=actor,
                action=AuditLog.ACTION_UPDATE,
                target_id=locked.pk,
                target_name=locked.code,
                description=f"Storage root {locked.code} changed: {', '.join(changed)}",
            )
        return locked

    @classmethod
    @transaction.atomic
    def delete(cls, *, actor: Any, root: StorageRoot) -> None:
        """Soft delete; refused while the root holds files that are not revoked."""
        locked = StorageRoot.objects.select_for_update().get(pk=root.pk)
        live = PublishedFile.all_objects.filter(storage_root=locked).exclude(
            status=PublishedFile.Status.REVOKED
        )
        if live.exists():
            raise ValidationError(
                {"detail": ["This root still holds registered files. Retire it instead."]}
            )
        locked.delete()
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_DELETE,
            target_id=locked.pk,
            target_name=locked.code,
            description=f"Storage root {locked.code} deleted",
        )
