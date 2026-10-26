"""
Task templates: writing them, copying them and applying them (WP D3, DECISIONS D-27).

``apply`` creates the tasks of a template for one shot or asset. It locks the entity row, so two
applies at once cannot both create a task, and it skips every task the entity already has with the
same type and name, so applying twice is harmless.
"""

from __future__ import annotations

import re
from typing import Any

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from apps.production.models import Asset, Shot, Task, TaskTemplate, TaskTemplateItem
from apps.production.services.task import TaskService

_CODE_UNSAFE = re.compile(r"[^A-Z0-9_-]+")
NAME_TAKEN = "A template with this name already exists."


class TaskTemplateService:
    # -- writing --------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def create(
        cls, *, user: Any, project: Any, data: dict[str, Any], items: list[dict[str, Any]]
    ) -> TaskTemplate:
        cls._ensure_name_free(project, data["name"], data["entity_type"])
        try:
            with transaction.atomic():
                template = TaskTemplate.objects.create(
                    project=project, created_by=user, updated_by=user, **data
                )
        except IntegrityError:
            raise ValidationError({"name": [NAME_TAKEN]}) from None
        cls._sync_items(template, items, user)
        return template

    @classmethod
    @transaction.atomic
    def update(
        cls,
        *,
        user: Any,
        template: TaskTemplate,
        data: dict[str, Any],
        items: list[dict[str, Any]] | None,
    ) -> TaskTemplate:
        locked = TaskTemplate.objects.select_for_update().get(pk=template.pk)
        new_name = data.get("name", locked.name)
        new_type = data.get("entity_type", locked.entity_type)
        if (new_name.lower(), new_type) != (locked.name.lower(), locked.entity_type):
            cls._ensure_name_free(locked.project, new_name, new_type, exclude=locked.pk)
        for field, value in data.items():
            setattr(locked, field, value)
        locked.updated_by = user
        try:
            with transaction.atomic():
                locked.save()
        except IntegrityError:
            raise ValidationError({"name": [NAME_TAKEN]}) from None
        if items is not None:
            cls._sync_items(locked, items, user)
        return locked

    @classmethod
    @transaction.atomic
    def copy_to_project(
        cls, *, user: Any, template: TaskTemplate, project: Any, name: str | None = None
    ) -> TaskTemplate:
        """A copy of ``template`` (studio-wide or another project's) that belongs to ``project``."""
        data = {
            "name": name or template.name,
            "description": template.description,
            "entity_type": template.entity_type,
            "is_active": template.is_active,
        }
        items = [
            {
                "task_type": item.task_type,
                "name": item.name,
                "order": item.order,
                "default_bid_hours": item.default_bid_hours,
            }
            for item in template.items.all()  # pyright: ignore[reportAttributeAccessIssue]
        ]
        return cls.create(user=user, project=project, data=data, items=items)

    @classmethod
    def _ensure_name_free(
        cls, project: Any, name: str, entity_type: str, *, exclude: Any = None
    ) -> None:
        taken = TaskTemplate.all_objects.filter(
            project=project, entity_type=entity_type, name__iexact=name, is_deleted=False
        )
        if exclude is not None:
            taken = taken.exclude(pk=exclude)
        if taken.exists():
            raise ValidationError({"name": [NAME_TAKEN]})

    @classmethod
    def _sync_items(cls, template: TaskTemplate, items: list[dict[str, Any]], user: Any) -> None:
        """Make the template's live items exactly ``items``: update matches, add new, drop the rest."""
        seen: set[tuple[Any, str]] = set()
        for entry in items:
            key = (entry["task_type"].pk, entry["name"].strip().lower())
            if key in seen:
                raise ValidationError(
                    {"items": [f'"{entry["name"]}" appears twice for the same task type.']}
                )
            seen.add(key)
        existing = {
            (item.task_type_id, item.name.strip().lower()): item  # pyright: ignore[reportAttributeAccessIssue]
            for item in TaskTemplateItem.objects.filter(template=template)
        }
        for position, entry in enumerate(items):
            key = (entry["task_type"].pk, entry["name"].strip().lower())
            order = entry.get("order", position)
            bid = entry.get("default_bid_hours", 0)
            item = existing.pop(key, None)
            if item is None:
                TaskTemplateItem.objects.create(
                    template=template,
                    task_type=entry["task_type"],
                    name=entry["name"].strip(),
                    order=order,
                    default_bid_hours=bid,
                    created_by=user,
                    updated_by=user,
                )
            else:
                item.name = entry["name"].strip()
                item.order = order
                item.default_bid_hours = bid
                item.updated_by = user
                item.save()
        from apps.core.services.soft_delete import SoftDeleteService

        for leftover in existing.values():
            SoftDeleteService.delete(leftover, user=user)

    # -- catalog --------------------------------------------------------------

    @classmethod
    def resolve_task_type(cls, ref: Any) -> Any:
        """The active catalog task type named by id or code (any case), else None."""
        from uuid import UUID

        from apps.masterdata.models import MasterTaskType

        text = str(ref or "").strip()
        if not text:
            return None
        base = MasterTaskType.objects.filter(status="active")
        try:
            return base.filter(pk=UUID(text)).first()
        except ValueError:
            return base.filter(code__iexact=text).first()

    # -- applying -------------------------------------------------------------

    @classmethod
    def resolve_entity(cls, template: TaskTemplate, project: Any, ref: Any) -> Any:
        """The live shot or asset of ``project`` (id or code) this template applies to."""
        model = Shot if template.entity_type == "Shot" else Asset
        noun = template.entity_type.lower()
        text = str(ref or "").strip()
        base = model.objects.filter(project=project)
        entity = None
        if text:
            try:
                from uuid import UUID

                entity = base.filter(pk=UUID(text)).first()
            except ValueError:
                entity = base.filter(code__iexact=text).first()
        if entity is None:
            raise ValidationError({"entity_id": [f"Unknown {noun}."]})
        return entity

    @classmethod
    @transaction.atomic
    def apply(cls, *, user: Any, template: TaskTemplate, entity: Any) -> dict[str, list[Task]]:
        """Create the template's tasks for ``entity``; those it already has (type and name) are kept."""
        if not template.is_active:
            raise ValidationError({"template": ["This template is switched off."]})
        model = type(entity)
        if model.__name__ != template.entity_type:
            raise ValidationError(
                {"entity_id": [f"This template is for a {template.entity_type.lower()}."]}
            )
        model.objects.select_for_update().get(pk=entity.pk)  # serialise concurrent applies
        created: list[Task] = []
        existing: list[Task] = []
        for item in template.items.select_related("task_type").all():  # pyright: ignore[reportAttributeAccessIssue]
            found = Task.objects.filter(
                project=entity.project,
                entity_type=template.entity_type,
                entity_id=str(entity.pk),
                task_type=item.task_type,
                title__iexact=item.name,
            ).first()
            if found is not None:
                existing.append(found)
                continue
            created.append(
                TaskService.create(
                    user=user,
                    project=entity.project,
                    title=item.name,
                    code=cls._task_code(entity, item),
                    entity_type=template.entity_type,
                    entity_id=str(entity.pk),
                    entity_code=entity.code,
                    entity_name=getattr(entity, "name", "") or "",
                    task_type=item.task_type,
                    department=item.task_type.department_name or "",
                    estimated_hours=item.default_bid_hours,
                )
            )
        return {"created": created, "existing": existing}

    @classmethod
    def _task_code(cls, entity: Any, item: TaskTemplateItem) -> str:
        """``<entity code>_<type code>``, with ``_2``, ``_3`` ... when the project already has it."""
        base = _CODE_UNSAFE.sub("-", f"{entity.code}_{item.task_type.code}".upper()).strip("-_")[
            :44
        ]
        code, number = base, 1
        while Task.all_objects.filter(project=entity.project, code__iexact=code).exists():
            number += 1
            code = f"{base}_{number}"
        return code
