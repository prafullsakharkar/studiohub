"""
Bulk mixin for production viewsets.

Extends the shared core ``BulkActionsMixin`` with a ``bulk-update`` that checks
every item exactly like a single update: the entity's update serializer, the
same-project reference checks and the privileged-value guard of the viewset.
The service stays free of API imports; it only calls the ``validate`` callable
it is handed.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.api.mixins.bulk import BulkActionsMixin


class ProductionBulkMixin(BulkActionsMixin):
    # Provided by ``ProductionEntityViewSet`` / ``ServiceModelViewSet`` (annotations only).
    serializer_map: dict[str, Any]  # pyright: ignore[reportUninitializedInstanceVariable]
    validate_references: Callable[..., None]  # pyright: ignore[reportUninitializedInstanceVariable]
    _guard_privileged_values: Callable[..., None]  # pyright: ignore[reportUninitializedInstanceVariable]

    @action(detail=False, methods=["post", "patch"], url_path="bulk-update")
    def bulk_update(self, request, *args, **kwargs):
        data = request.data or {}
        if isinstance(data, dict) and ("ids" in data or "changes" in data):
            ids = data.get("ids", [])
            changes = dict(data.get("changes") or {})
            if not isinstance(ids, list):
                raise ValidationError({"ids": "Must be a list."})
            items = [{"id": item_id, **changes} for item_id in ids]
        elif isinstance(data, list):
            items = data
        else:
            items = data.get("items", [])
            if not isinstance(items, list):
                raise ValidationError({"items": "Must be a list."})
        results = self.service_class.bulk_update(
            items,
            organization=self._organization(),
            user=request.user,
            validate=self._validate_bulk_item,
        )
        return self._bulk_create_union(results)

    def _validate_bulk_item(self, instance, data) -> tuple[dict[str, Any] | None, Any]:
        """``(validated data, None)`` for an acceptable item, else ``(None, errors)``."""
        serializer_class = self.serializer_map["partial_update"]
        serializer = serializer_class(
            instance=instance, data=data, partial=True, context=self.get_serializer_context()
        )
        if not serializer.is_valid():
            return None, serializer.errors
        validated = dict(serializer.validated_data)
        try:
            self.validate_references(
                getattr(instance, "project", None), validated, instance=instance
            )
            self._guard_privileged_values(validated, instance=instance)
        except ValidationError as exc:
            return None, exc.detail
        except PermissionDenied as exc:
            return None, {"detail": str(exc.detail)}
        return validated, None
