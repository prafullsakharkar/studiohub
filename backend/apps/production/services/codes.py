"""
Renaming codes.

A shot's or asset's code is in file and publish names, so it freezes once a version
exists (``NormalizedCodeMixin``). A deliberate rename goes through here: unique in the
project whatever the case, upper case, free of spaces and slashes, and the copies of
the code kept on tasks, versions and reviews are updated in the same transaction. The
change itself is recorded by the change log (who, when, old and new code).
"""

from __future__ import annotations

import re
from typing import Any

from django.db import transaction
from rest_framework.exceptions import ValidationError

_FORBIDDEN = re.compile(r"[\s/\\]")


class CodeService:
    @classmethod
    def normalize(cls, value: str) -> str:
        code = (value or "").strip()
        if not code:
            raise ValidationError({"code": ["A code is required."]})
        if _FORBIDDEN.search(code):
            raise ValidationError({"code": ["A code cannot contain spaces or slashes."]})
        return code.upper()

    @classmethod
    @transaction.atomic
    def rename_code(cls, *, actor: Any, entity: Any, new_code: str) -> Any:
        from apps.production.models import Review, Task, Version

        code = cls.normalize(new_code)
        model = type(entity)
        locked = model._base_manager.select_for_update().get(pk=entity.pk)
        if code == locked.code:
            return entity
        taken = (
            model.all_objects.filter(project_id=locked.project_id, code__iexact=code)
            .exclude(pk=locked.pk)
            .exists()
        )
        if taken:
            raise ValidationError({"code": ["A record with this code already exists."]})
        entity.code = code
        fields = ["code", "updated_at"]
        if getattr(actor, "is_authenticated", False):
            entity.updated_by = actor
            fields.append("updated_by")
        entity.save(update_fields=fields)
        for dependent in (Task, Version, Review):
            dependent.all_objects.filter(
                project_id=locked.project_id, entity_type=model.__name__, entity_id=str(entity.pk)
            ).update(entity_code=code)
        return entity
