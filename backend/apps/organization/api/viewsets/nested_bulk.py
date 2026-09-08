"""
Bulk and restore actions for parent-nested organization viewsets.

Shared by the client/vendor contact and contract viewsets. Mirrors the
production ``SequenceViewSet`` bulk envelope::

    {"processed": N, "successful": M, "failed": K, "results": [...]}

Per-item statuses are ``created`` | ``updated`` | ``deleted`` | ``restored``
| ``not_found`` | ``invalid``. Parents are resolved from the URL with the
same organization scoping as single-object creates — a user can never
bulk-operate on another organization's parent (404).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, ClassVar, cast

from django.http import Http404
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from apps.core.exceptions.base import DuplicateException


class NestedBulkActionsMixin:
    """
    Bulk create/update/delete/restore plus single restore for nested resources.

    The viewset must define:

    * ``parent_accessor`` — name of the method resolving the URL parent
      (e.g. ``"_get_parent_client"``), returning ``None`` when unresolvable.
    * ``parent_field`` — FK field name on the child model (``"client"``).
    * ``parent_organization_field`` — always ``"organization"`` unless overridden.
    * ``detail_serializer_class`` — read serializer used for entity output.
    * ``create_serializer_class`` / ``update_serializer_class``.
    """

    parent_accessor = ""
    parent_field = ""
    parent_organization_field = "organization"
    detail_serializer_class: ClassVar[type[serializers.Serializer[Any]]]
    create_serializer_class: ClassVar[type[serializers.Serializer[Any]]]
    update_serializer_class: ClassVar[type[serializers.Serializer[Any]]]
    # Mixin contract: provided by the viewset this mixin is combined with.
    # Annotations only, no runtime effect.
    request: ClassVar[Any]
    service_class: ClassVar[Any]
    get_serializer_context: ClassVar[Callable[..., dict[str, Any]]]

    CREATED = "created"
    UPDATED = "updated"
    ARCHIVED = "archived"
    RESTORED = "restored"
    DUPLICATE = "duplicate"
    NOT_FOUND = "not_found"
    INVALID = "invalid"

    SUCCESS_STATUSES = (CREATED, UPDATED, ARCHIVED, RESTORED)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _bulk_parent(self):
        accessor = getattr(self, self.parent_accessor, None)
        parent = accessor() if accessor else None
        if parent is None:
            raise Http404
        return parent

    def _scoped_filters(self, parent):
        """Org + parent filters; staff requests carry no org context."""
        filters = {self.parent_field: parent}
        organization = getattr(self.request, "organization", None)
        if organization is not None:
            filters[self.parent_organization_field] = organization
        return filters

    def _live_child(self, parent, child_id):
        """Non-deleted child of ``parent`` within scope, or ``None``."""
        return (
            self.service_class.filter(
                id=child_id,
                **self._scoped_filters(parent),
            )
            .filter(is_deleted=False)
            .first()
        )

    def _deleted_child(self, parent, child_id):
        """Soft-deleted child of ``parent`` within scope, or ``None``."""
        return (
            self.service_class.model.all_objects.filter(
                id=child_id,
                is_deleted=True,
                **self._scoped_filters(parent),
            ).first()
        )

    def _bulk_response(self, results):
        context = self.get_serializer_context()
        output = []
        successful = 0
        for result in results:
            item = {k: v for k, v in result.items() if k != "entity"}
            if result.get("entity") is not None:
                item["entity"] = self.detail_serializer_class(
                    result["entity"],
                    context=context,
                ).data
            if result["status"] in self.SUCCESS_STATUSES:
                successful += 1
            output.append(item)
        return Response(
            {
                "processed": len(results),
                "successful": successful,
                "failed": len(results) - successful,
                "results": output,
            }
        )

    def _items_list(self):
        items = self.request.data.get("items", [])
        if not isinstance(items, list):
            raise ValidationError({"items": "Must be a list."})
        return items

    def _ids_list(self):
        ids = self.request.data.get("ids", [])
        if not isinstance(ids, list):
            raise ValidationError({"ids": "Must be a list."})
        return ids

    # ------------------------------------------------------------------
    # Bulk actions
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request, *args, **kwargs):
        parent = self._bulk_parent()
        results = []
        for index, item in enumerate(self._items_list()):
            serializer = self.create_serializer_class(data=item)
            if not serializer.is_valid():
                results.append(
                    {"index": index, "status": self.INVALID, "error": serializer.errors}
                )
                continue
            try:
                instance = self.service_class.create(
                    user=request.user,
                    **{self.parent_field: parent},
                    **{self.parent_organization_field: parent.organization},
                    **cast(dict[str, Any], serializer.validated_data),
                )
            except DuplicateException as exc:
                results.append(
                    {"index": index, "status": self.DUPLICATE, "error": str(exc)}
                )
                continue
            except Exception as exc:  # noqa: BLE001
                results.append(
                    {"index": index, "status": self.INVALID, "error": str(exc)}
                )
                continue
            results.append(
                {
                    "index": index,
                    "status": self.CREATED,
                    "id": str(instance.id),
                    "entity": instance,
                }
            )
        return self._bulk_response(results)

    @action(detail=False, methods=["patch"], url_path="bulk-update")
    def bulk_update(self, request, *args, **kwargs):
        parent = self._bulk_parent()
        results = []
        for index, item in enumerate(self._items_list()):
            child_id = item.get("id") if isinstance(item, dict) else None
            if not child_id:
                results.append(
                    {"index": index, "status": self.INVALID, "error": "id is required."}
                )
                continue
            instance = self._live_child(parent, child_id)
            if instance is None:
                results.append(
                    {"index": index, "status": self.NOT_FOUND, "error": "Not found."}
                )
                continue
            data = {k: v for k, v in item.items() if k != "id"}
            serializer = self.update_serializer_class(
                instance=instance, data=data, partial=True
            )
            if not serializer.is_valid():
                results.append(
                    {"index": index, "status": self.INVALID, "error": serializer.errors}
                )
                continue
            try:
                updated = self.service_class.update(
                    instance,
                    user=request.user,
                    **cast(dict[str, Any], serializer.validated_data),
                )
            except Exception as exc:  # noqa: BLE001
                results.append(
                    {"index": index, "status": self.INVALID, "error": str(exc)}
                )
                continue
            results.append(
                {
                    "index": index,
                    "status": self.UPDATED,
                    "id": str(updated.id),
                    "entity": updated,
                }
            )
        return self._bulk_response(results)

    @action(detail=False, methods=["post"], url_path="bulk-archive")
    def bulk_archive(self, request, *args, **kwargs):
        parent = self._bulk_parent()
        results = []
        for index, child_id in enumerate(self._ids_list()):
            instance = self._live_child(parent, child_id)
            if instance is None:
                results.append(
                    {"index": index, "status": self.NOT_FOUND, "error": "Not found."}
                )
                continue
            self.service_class.delete(instance, user=request.user)
            results.append(
                {"index": index, "status": self.ARCHIVED, "id": str(instance.id)}
            )
        return self._bulk_response(results)

    @action(detail=False, methods=["post"], url_path="bulk-restore")
    def bulk_restore(self, request, *args, **kwargs):
        parent = self._bulk_parent()
        results = []
        for index, child_id in enumerate(self._ids_list()):
            instance = self._deleted_child(parent, child_id)
            if instance is None:
                results.append(
                    {"index": index, "status": self.NOT_FOUND, "error": "Not found."}
                )
                continue
            self.service_class.restore(instance, user=request.user)
            results.append(
                {
                    "index": index,
                    "status": self.RESTORED,
                    "id": str(instance.id),
                    "entity": instance,
                }
            )
        return self._bulk_response(results)

    # ------------------------------------------------------------------
    # Single restore
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        parent = self._bulk_parent()
        child_id = kwargs.get("uuid") or kwargs.get("pk")
        instance = self._deleted_child(parent, child_id)
        if instance is None:
            raise NotFound("Not found.")
        self.service_class.restore(instance, user=request.user)
        return Response(
            self.detail_serializer_class(
                instance,
                context=self.get_serializer_context(),
            ).data
        )
