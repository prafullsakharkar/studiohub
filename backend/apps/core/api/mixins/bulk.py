"""
Shared bulk actions mixin for DRF viewsets.

Provides reusable bulk create/update/archive/restore + existence check
actions with union response shapes compatible with the frontend contract.

Usage:
    class MyViewSet(BulkActionsMixin, BaseViewSet):
        detail_serializer_class = MyDetailSerializer
        service_class = MyService

        permission_map = {
            ...,
            "bulk_create": (MyPermissions.CREATE,),
            "bulk_update": (MyPermissions.UPDATE,),
            "bulk_archive": (MyPermissions.DELETE,),
            "bulk_restore": (MyPermissions.UPDATE,),
            "check_existence": (MyPermissions.CREATE,),
            "archive": (MyPermissions.DELETE,),
            "restore": (MyPermissions.UPDATE,),
        }

Service must implement:
    - bulk_check_existence(items, organization)
    - bulk_create(items, organization, user)
    - bulk_update(items, organization, user)
    - bulk_archive(ids, organization, user)
    - bulk_restore(ids, organization, user)
    - delete(instance, user)  # for single archive
    - restore(instance)       # for single restore
    - get_archived(organization, project_id)  # optional, for archived listing

Model should have:
    - is_deleted field (soft-delete)
    - deleted_at field
    - status field with "Archived" / "In Progress" choices (optional)
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Any, ClassVar

from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response


# Service status -> frontend EntityResolutionState
_EXISTENCE_STATE = {
    "new": "NEW",
    "created": "NEW",
    "exists": "EXISTS",
    "soft_deleted": "SOFT_DELETED",
    "duplicate": "DUPLICATE_IN_REQUEST",
    "invalid": "INVALID",
}


class BulkActionsMixin:
    """
    Bulk + existence + archive/restore actions with union responses.

    Concrete viewsets must set:
        - detail_serializer_class: serializer for entity detail in responses
        - service_class: service with bulk_* methods (see class docstring)
    """

    detail_serializer_class: ClassVar[type[serializers.Serializer[Any]]]
    # Mixin contract: provided by the viewset this mixin is combined with.
    # Annotations only, no runtime effect.
    request: ClassVar[Any]
    service_class: ClassVar[Any]
    get_serializer_context: ClassVar[Callable[..., dict[str, Any]]]
    paginate_queryset: ClassVar[Callable[..., Any]]
    get_serializer: ClassVar[Callable[..., Any]]
    get_paginated_response: ClassVar[Callable[..., Any]]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _organization(self):
        org = getattr(self.request, "organization", None)
        if org is None:
            raise ValidationError({"organization": "An active organization is required."})
        return org

    def _detail_data(self, instance):
        assert self.detail_serializer_class is not None, (
            "detail_serializer_class must be set on the viewset."
        )
        return self.detail_serializer_class(
            instance,
            context=self.get_serializer_context(),
        ).data

    def _fetch_instance(self, instance_id):
        model = self.service_class.model
        try:
            return model.all_objects.filter(id=instance_id).first()
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _new_operation() -> dict[str, Any]:
        return {
            "operation_id": uuid.uuid4().hex,
            "timestamp": timezone.now().isoformat(),
        }

    def _clean_create_data(self, data):
        """Whitelist create payload keys to concrete model fields."""
        model = self.service_class.model
        allowed = set()
        for field in model._meta.get_fields():
            if getattr(field, "concrete", False):
                allowed.add(field.name)
                attname = getattr(field, "attname", None)
                if attname:
                    allowed.add(attname)
        cleaned = {k: v for k, v in dict(data or {}).items() if k in allowed}
        cleaned.pop("id", None)
        cleaned.pop("organization", None)
        cleaned.pop("organization_id", None)
        cleaned.pop("project", None)
        return cleaned

    def _set_status(self, instance, value):
        """Flip ``status`` when the model supports the value."""
        try:
            field = self.service_class.model._meta.get_field("status")
        except Exception:  # noqa: BLE001
            return
        choices = {choice[0] for choice in (field.choices or [])}
        if value in choices:
            instance.status = value
            instance.save(update_fields=["status"])

    def _lookup_id(self, kwargs):
        return kwargs.get("uuid") or kwargs.get("pk")

    # ------------------------------------------------------------------
    # Existence check
    # ------------------------------------------------------------------

    def _existence_items_from_request(self):
        data = self.request.data or {}
        codes = data.get("codes")
        if isinstance(codes, list):
            project_id = data.get("project_id")
            return [{"project_id": project_id, "code": code} for code in codes]
        items = data.get("items", [])
        if not isinstance(items, list):
            raise ValidationError({"items": "Must be a list."})
        return items

    def _existence_response(self, input_items, service_results):
        contract_items = []
        for index, result in enumerate(service_results):
            code = ""
            if index < len(input_items):
                raw = input_items[index] or {}
                code = (raw.get("code") or "").strip().upper()
            state = _EXISTENCE_STATE.get(result.get("status"), "INVALID")
            entry = {"code": code, "state": state}
            if result.get("status") in ("exists", "soft_deleted") and result.get("id"):
                instance = self._fetch_instance(result["id"])
                if instance is not None:
                    entry["existing_entity"] = self._detail_data(instance)
                if result.get("status") == "soft_deleted":
                    deleted_at = result.get("deleted_at")
                    entry["message"] = (
                        f"Code was archived on {deleted_at}." if deleted_at
                        else "Code was archived and can be recovered."
                    )
            if result.get("error") and state == "INVALID":
                entry["message"] = result["error"]
            contract_items.append(entry)
        legacy_results = []
        for index, result in enumerate(service_results):
            legacy_results.append(
                {
                    "index": result.get("index", index),
                    "status": result.get("status"),
                    "id": result.get("id"),
                    "deleted_at": result.get("deleted_at"),
                    "error": result.get("error"),
                }
            )
        return Response({"items": contract_items, "results": legacy_results})

    @action(detail=False, methods=["post"], url_path="check-existence")
    def check_existence(self, request, *args, **kwargs):
        items = self._existence_items_from_request()
        results = self.service_class.bulk_check_existence(
            items,
            organization=self._organization(),
        )
        return self._existence_response(items, results)

    @action(detail=False, methods=["post"], url_path="existence-check")
    def existence_check(self, request, *args, **kwargs):
        """Legacy alias of ``check-existence/`` (kept for compatibility)."""
        return self.check_existence(request, *args, **kwargs)

    # ------------------------------------------------------------------
    # Bulk create
    # ------------------------------------------------------------------

    def _bulk_create_union(self, results, *, summary_extra=None):
        base = self._new_operation()
        successful_statuses = {
            self.service_class.CREATED,
            self.service_class.UPDATED,
            self.service_class.ARCHIVED,
            self.service_class.RESTORED,
            "recovered",
            "skipped",
        }
        output = []
        successful = 0
        summary = {
            "total": len(results),
            "newCount": 0,
            "existingCount": 0,
            "softDeletedCount": 0,
            "duplicateCount": 0,
            "invalidCount": 0,
            "recoveredCount": 0,
            "skippedCount": 0,
            "createdCount": 0,
            "updatedCount": 0,
            "failedCount": 0,
        }
        if summary_extra:
            summary.update(summary_extra)
        context = self.get_serializer_context()
        for result in results:
            status = result.get("status")
            entity = result.get("entity")
            code = result.get("code") or getattr(entity, "code", None)
            item = {
                "index": result.get("index"),
                "id": result.get("id"),
                "code": code,
                "status": status,
                "success": status in successful_statuses,
                "error": result.get("error"),
            }
            action_taken = {
                self.service_class.CREATED: "created",
                self.service_class.UPDATED: "updated",
                self.service_class.ARCHIVED: "archived",
                self.service_class.RESTORED: "restored",
                "recovered": "recovered",
                "skipped": "skipped",
            }.get(status, "failed")
            item["actionTaken"] = action_taken
            if result.get("suggestedAction"):
                item["suggestedAction"] = result["suggestedAction"]
            if entity is not None:
                item["entity"] = self.detail_serializer_class(
                    entity,
                    context=context,
                ).data
            if item["success"]:
                successful += 1
            else:
                summary["failedCount"] += 1
            if status == self.service_class.CREATED:
                summary["createdCount"] += 1
            elif status == self.service_class.UPDATED:
                summary["updatedCount"] += 1
            elif status == "recovered":
                summary["recoveredCount"] += 1
            elif status == "skipped":
                summary["skippedCount"] += 1
            elif status == self.service_class.EXISTS:
                summary["existingCount"] += 1
            elif status == self.service_class.SOFT_DELETED:
                summary["softDeletedCount"] += 1
            elif status == self.service_class.DUPLICATE:
                summary["duplicateCount"] += 1
            elif status == self.service_class.INVALID:
                summary["invalidCount"] += 1
            output.append(item)
        failed = len(results) - successful
        base.update(
            {
                "processed": len(results),
                "successful": successful,
                "failed": failed,
                "summary": summary,
                "results": output,
                "partial_success": successful > 0 and failed > 0,
            }
        )
        return Response(base)

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request, *args, **kwargs):
        data = request.data or {}
        raw_items = data.get("items", [])
        if not isinstance(raw_items, list):
            raise ValidationError({"items": "Must be a list."})
        top_project_id = data.get("project_id")
        react_form = top_project_id is not None or any(
            isinstance(item, dict) and ("action" in item or "data" in item)
            for item in raw_items
        )
        service = self.service_class
        org = self._organization()
        if not react_form:
            results = service.bulk_create(
                raw_items,
                organization=org,
                user=request.user,
            )
            return self._bulk_create_union(results)

        # Frontend form: per-item disposition decided by the client.
        flat_creates = []
        create_positions = []
        results_by_index: dict[int, dict[str, Any]] = {}
        for index, item in enumerate(raw_items):
            item = dict(item or {})
            project_id = item.get("project_id") or top_project_id
            code = (item.get("code") or "").strip().upper()
            act = (item.get("action") or "create").strip().lower()
            payload = item.get("data") or {}
            if act == "skip":
                results_by_index[index] = {
                    "index": index, "status": "skipped", "code": code,
                }
                continue
            if act == "recover":
                recovered = self._recover_item(
                    project_id=project_id, code=code,
                    existing_id=item.get("existing_id"), organization=org,
                )
                recovered["index"] = index
                results_by_index[index] = recovered
                continue
            flat = {"project_id": project_id, "code": code}
            flat.update(self._clean_create_data(payload))
            flat_creates.append(flat)
            create_positions.append(index)
        if flat_creates:
            created = service.bulk_create(
                flat_creates,
                organization=org,
                user=request.user,
            )
            for flat_result, position in zip(created, create_positions, strict=True):
                flat_result = dict(flat_result)
                flat_result["index"] = position
                if flat_result.get("status") == service.EXISTS:
                    flat_result["suggestedAction"] = "skip"
                elif flat_result.get("status") == service.SOFT_DELETED:
                    flat_result["suggestedAction"] = "recover"
                results_by_index[position] = flat_result
        ordered = [results_by_index[i] for i in sorted(results_by_index)]
        return self._bulk_create_union(ordered)

    def _recover_item(self, *, project_id, code, existing_id, organization):
        service = self.service_class
        instance = None
        if existing_id:
            instance = self._fetch_instance(existing_id)
        if instance is None and project_id and code:
            project = service._get_project(
                organization=organization, project_id=project_id,
            )
            if project is not None:
                instance = service.model.all_objects.filter(
                    organization=organization, project=project, code=code,
                ).first()
        if instance is None or not instance.is_deleted:
            return {
                "status": service.INVALID, "code": code,
                "error": "No archived row found to recover.",
            }
        service.restore(instance)
        return {"status": "recovered", "id": str(instance.id), "code": code, "entity": instance}

    # ------------------------------------------------------------------
    # Bulk update
    # ------------------------------------------------------------------

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
        )
        return self._bulk_create_union(results)

    # ------------------------------------------------------------------
    # Bulk archive / restore
    # ------------------------------------------------------------------

    def _bulk_archive_union(self, results, *, count_key):
        base = self._new_operation()
        successful = sum(
            1 for r in results
            if r.get("status") in (self.service_class.ARCHIVED, self.service_class.RESTORED)
        )
        failed = len(results) - successful
        output = []
        for result in results:
            status = result.get("status")
            output.append(
                {
                    "index": result.get("index"),
                    "id": result.get("id"),
                    "status": status,
                    "success": status
                    in (self.service_class.ARCHIVED, self.service_class.RESTORED),
                    "actionTaken": "archived"
                    if status == self.service_class.ARCHIVED
                    else ("restored" if status == self.service_class.RESTORED else "failed"),
                }
            )
        base.update(
            {
                "processed": len(results),
                "successful": successful,
                "failed": failed,
                "summary": {"total": len(results), count_key: successful, "failedCount": failed},
                "results": output,
                "partial_success": successful > 0 and failed > 0,
                # Frontend contract aliases (mock shape): top-level success flag
                # plus the affected-row count.
                "success": failed == 0,
                "updated_count": successful,
            }
        )
        return Response(base)

    def _ids_list(self):
        data = self.request.data or {}
        ids = data.get("ids", data.get("task_ids", []))
        if not isinstance(ids, list):
            raise ValidationError({"ids": "Must be a list."})
        return ids

    @action(detail=False, methods=["post"], url_path="bulk-archive")
    def bulk_archive(self, request, *args, **kwargs):
        results = self.service_class.bulk_archive(
            self._ids_list(),
            organization=self._organization(),
            user=request.user,
        )
        return self._bulk_archive_union(results, count_key="archivedCount")

    @action(detail=False, methods=["post"], url_path="bulk-restore")
    def bulk_restore(self, request, *args, **kwargs):
        results = self.service_class.bulk_restore(
            self._ids_list(),
            organization=self._organization(),
            user=request.user,
        )
        return self._bulk_archive_union(results, count_key="restoredCount")

    # ------------------------------------------------------------------
    # Single archive / restore
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, *args, **kwargs):
        instance = self.service_class.model.objects.filter(
            organization=self._organization(),
            id=self._lookup_id(kwargs),
        ).first()
        if instance is None:
            raise NotFound(f"{self.service_class.model.__name__} not found.")
        self._set_status(instance, "Archived")
        self.service_class.delete(instance, user=request.user)
        return Response(self._detail_data(instance))

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        instance = self.service_class.model.all_objects.filter(
            organization=self._organization(),
            id=self._lookup_id(kwargs),
        ).first()
        if instance is None or not instance.is_deleted:
            raise NotFound(f"{self.service_class.model.__name__} not found.")
        self.service_class.restore(instance)
        self._set_status(instance, "In Progress")
        return Response(self._detail_data(instance))

    # ------------------------------------------------------------------
    # Optional: archived listing (override if service supports get_archived)
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"], url_path="archived")
    def archived(self, request):
        """List soft-deleted entities (requires service.get_archived)."""
        if not hasattr(self.service_class, "get_archived"):
            raise NotFound("Archived listing not supported.")
        project_id = request.query_params.get("project_id")
        qs = self.service_class.get_archived(
            organization=self._organization(),
            project_id=project_id,
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)