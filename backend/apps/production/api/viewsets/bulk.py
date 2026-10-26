"""
Bulk mixin for production viewsets.

Extends the shared core ``BulkActionsMixin`` so every bulk item is checked
exactly like its single counterpart: the entity's create/update serializer, the
same-project reference checks, the privileged-value guard and the status
workflow of the viewset. The service stays free of API imports; it only calls
the callables it is handed.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from apps.core.api.mixins.bulk import BulkActionsMixin
from apps.production.services.status import StatusService


class ProductionBulkMixin(BulkActionsMixin):
    # Provided by ``ProductionEntityViewSet`` / ``ServiceModelViewSet`` (annotations only).
    serializer_map: dict[str, Any]  # pyright: ignore[reportUninitializedInstanceVariable]
    validate_references: Callable[..., None]  # pyright: ignore[reportUninitializedInstanceVariable]
    prepare_create: Callable[..., None]  # pyright: ignore[reportUninitializedInstanceVariable]
    _guard_privileged_values: Callable[..., None]  # pyright: ignore[reportUninitializedInstanceVariable]
    _guard_initial_status: Callable[..., None]  # pyright: ignore[reportUninitializedInstanceVariable]
    _apply_update: Callable[..., Any]  # pyright: ignore[reportUninitializedInstanceVariable]

    def _bulk_service_kwargs(self, operation):
        if operation == "create":
            return {"validate": self._validate_bulk_create_item}
        if operation == "update":
            return {"validate": self._validate_bulk_item, "update": self._apply_update}
        return {}

    @staticmethod
    def _errors_of(exc: APIException) -> Any:
        return exc.detail

    def _validate_bulk_create_item(self, project, item) -> tuple[dict[str, Any] | None, Any]:
        """``(data to create with, None)`` for an acceptable item, else ``(None, errors)``."""
        serializer = self.serializer_map["create"](data=item, context=self.get_serializer_context())
        if not serializer.is_valid():
            return None, serializer.errors
        try:
            self.prepare_create(serializer, project)
            data = {**serializer.validated_data, "project": project}
            self.validate_references(project, data)
            self._guard_privileged_values(data)
            self._guard_initial_status(data)
        except (ValidationError, PermissionDenied, APIException) as exc:
            return None, self._errors_of(exc)
        return data, None

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
            if self.workflow_key and validated.get("status") not in (None, instance.status):  # pyright: ignore[reportAttributeAccessIssue]
                StatusService.check(
                    entity=instance,
                    to_status=validated["status"],
                    has_permission=self.can,  # pyright: ignore[reportAttributeAccessIssue]
                )
        except (ValidationError, PermissionDenied, APIException) as exc:
            return None, self._errors_of(exc)
        return validated, None
