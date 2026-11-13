"""
Path template use cases (review-pipeline RP-4, C-RP-18). Writes need ``publishing.template.manage``.

The key (project, file type, role) is fixed once a template is created; its root, pattern,
``enforce`` and ``is_active`` may change. A project's template needs the caller to be a full
member of the project (SEC-PUB-01); a studio template has no project.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models.functions import Upper
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.masterdata.selectors.catalog import MasterFileTypeSelector
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.selectors.project import ProjectSelector
from apps.publishing.domain.templates import TemplateError, check_pattern, matches, render
from apps.publishing.models import PublishedFile, PublishPathTemplate, StorageRoot
from apps.publishing.selectors.templates import PathTemplateSelector, version_values
from apps.publishing.services import audit

_ROLES = {choice.value for choice in PublishedFile.Role}
_KEY = ("project", "file_type", "role")
_EDITABLE = ("storage_root", "pattern", "enforce", "is_active")
_DUPLICATE = "An active template already exists for this file type and role."


def _actor_or_none(actor: Any):
    return actor if getattr(actor, "is_authenticated", False) else None


def _root(value: Any) -> StorageRoot:
    code = str(value or "").strip()
    root = (
        StorageRoot.objects.filter(is_active=True)
        .annotate(u=Upper("code"))
        .filter(u=code.upper())
        .first()
        if code
        else None
    )
    if root is None:
        raise ValidationError({"storage_root": ["Unknown or inactive storage root."]})
    return root


def _pattern(value: Any) -> str:
    pattern = str(value or "")
    try:
        check_pattern(pattern)
    except TemplateError as error:
        raise ValidationError({"pattern": [str(error)]}) from error
    return pattern


def _project(request: Any, value: Any) -> Any:
    """The project of a project template, by id only; ``None`` for a studio template."""
    if value in (None, ""):
        return None
    try:
        project = ProjectSelector.resolve_by_lookup(UUID(str(value)))
    except ValueError:
        project = None
    visible = ProductionBaseSelector.visible_project_ids(request)
    if project is None or (visible is not None and project.pk not in visible):
        raise ValidationError({"project": ["Unknown project."]})
    return project


def _boolean(data: dict[str, Any], name: str, default: bool) -> bool:
    value = data.get(name, default)
    if not isinstance(value, bool):
        raise ValidationError({name: ["Must be a valid boolean."]})
    return value


class PathTemplateService:
    @classmethod
    @transaction.atomic
    def create(cls, *, actor: Any, request: Any, data: dict[str, Any]) -> PublishPathTemplate:
        project = _project(request, data.get("project"))
        file_type = MasterFileTypeSelector.resolve_active(str(data.get("file_type") or ""))
        if file_type is None:
            raise ValidationError({"file_type": ["Unknown or inactive file type."]})
        role = data.get("role") or PublishedFile.Role.MAIN
        if role not in _ROLES:
            raise ValidationError({"role": [f"One of: {', '.join(sorted(_ROLES))}."]})
        root = _root(data.get("storage_root"))
        pattern = _pattern(data.get("pattern"))
        enforce = _boolean(data, "enforce", False)
        is_active = _boolean(data, "is_active", True)
        if is_active:
            cls._refuse_duplicate(project=project, file_type=file_type, role=role)
        try:
            with transaction.atomic():
                template = PublishPathTemplate.objects.create(
                    project=project,
                    file_type=file_type,
                    role=role,
                    storage_root=root,
                    pattern=pattern,
                    enforce=enforce,
                    is_active=is_active,
                    created_by=_actor_or_none(actor),
                )
        except IntegrityError as error:  # a concurrent create of the same key
            raise ValidationError({"detail": [_DUPLICATE]}) from error
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_CREATE,
            target_id=template.pk,
            target_name=f"template:{file_type.code}:{role}",
            description=f"Path template created for {file_type.code} ({role})",
            project_id=project.pk if project else None,
        )
        return template

    @classmethod
    @transaction.atomic
    def update(
        cls, *, actor: Any, request: Any, template: PublishPathTemplate, data: dict[str, Any]
    ) -> PublishPathTemplate:
        locked = PublishPathTemplate.objects.select_for_update().get(pk=template.pk)
        cls._refuse_key_change(locked, data)
        values: dict[str, Any] = {}
        if "storage_root" in data:
            values["storage_root"] = _root(data["storage_root"])
        if "pattern" in data:
            values["pattern"] = _pattern(data["pattern"])
        if "enforce" in data:
            values["enforce"] = _boolean(data, "enforce", locked.enforce)
        if "is_active" in data:
            values["is_active"] = _boolean(data, "is_active", locked.is_active)
        changed = [name for name, value in values.items() if getattr(locked, name) != value]
        if not changed:
            return locked
        if values.get("is_active") and not locked.is_active:
            cls._refuse_duplicate(
                project=locked.project, file_type=locked.file_type, role=locked.role
            )
        for name in changed:
            setattr(locked, name, values[name])
        locked.updated_by = _actor_or_none(actor)
        try:
            with transaction.atomic():
                locked.save(update_fields=[*changed, "updated_by", "updated_at"])
        except IntegrityError as error:
            raise ValidationError({"detail": [_DUPLICATE]}) from error
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_UPDATE,
            target_id=locked.pk,
            target_name=f"template:{locked.file_type.code}:{locked.role}",
            description=f"Path template changed: {', '.join(sorted(changed))}",
            project_id=locked.project_id,  # pyright: ignore[reportAttributeAccessIssue]
        )
        return locked

    @staticmethod
    def _refuse_duplicate(*, project: Any, file_type: Any, role: str) -> None:
        rows = PublishPathTemplate.objects.filter(file_type=file_type, role=role, is_active=True)
        rows = rows.filter(project=project) if project else rows.filter(project__isnull=True)
        if rows.exists():
            raise ValidationError({"detail": [_DUPLICATE]})

    @staticmethod
    def _refuse_key_change(template: PublishPathTemplate, data: dict[str, Any]) -> None:
        errors: dict[str, list[str]] = {}
        if "project" in data and str(data["project"] or "") != str(template.project_id or ""):  # pyright: ignore[reportAttributeAccessIssue]
            errors["project"] = ["Cannot be changed. Retire this template and create another."]
        if (
            "file_type" in data
            and str(data["file_type"] or "").upper() != template.file_type.code.upper()
        ):
            errors["file_type"] = ["Cannot be changed. Retire this template and create another."]
        if "role" in data and data["role"] != template.role:
            errors["role"] = ["Cannot be changed. Retire this template and create another."]
        if errors:
            raise ValidationError(errors)


class ResolvedPath:
    """What ``resolve`` answers: the template, its root and the rendered path (``{name}`` left in)."""

    def __init__(self, template: PublishPathTemplate, relative_path: str) -> None:
        self.template = template
        self.storage_root = template.storage_root
        self.relative_path = relative_path


def resolve(version: Any, file_type: Any, role: str) -> ResolvedPath | None:
    """
    The path a file of ``version`` with this type and role should have, or ``None`` when no
    template applies. A template that cannot be filled for the version raises ``TemplateError``.
    """
    if file_type is None:
        return None
    template = PathTemplateSelector.applicable(
        project_id=version.project_id, file_type_id=file_type.pk, role=role
    )
    if template is None:
        return None
    return ResolvedPath(template, render(template.pattern, version_values(version, file_type)))


def enforce(version: Any, cleaned: dict[str, Any]) -> None:
    """
    Refuse a registration that an enforcing template does not allow (Q-RP-22 = B).

    Without a file type, or without an enforcing template, nothing is checked.
    """
    file_type = cleaned.get("file_type")
    if file_type is None:
        return
    template = PathTemplateSelector.applicable(
        project_id=version.project_id, file_type_id=file_type.pk, role=cleaned["role"]
    )
    if template is None or not template.enforce:
        return
    try:
        expected = render(template.pattern, version_values(version, file_type))
    except TemplateError as error:
        raise ValidationError(
            {"relative_path": [f"The path template cannot be filled: {error}"]}
        ) from error
    errors: dict[str, list[str]] = {}
    if cleaned["storage_root"].pk != template.storage_root_id:  # pyright: ignore[reportAttributeAccessIssue]
        errors["storage_root"] = [
            f"The path template puts this file under {template.storage_root.code}."
        ]
    if not matches(expected, cleaned["relative_path"]):
        errors["relative_path"] = [f"Does not match the path template: {expected}"]
    if errors:
        raise ValidationError(errors)


__all__ = ["PathTemplateService", "ResolvedPath", "enforce", "resolve"]
