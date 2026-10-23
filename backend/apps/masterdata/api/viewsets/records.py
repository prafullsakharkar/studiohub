"""
Shared bases for the directory viewsets (docs/masterdata/CONTRACTS.md §2.2).

``DirectoryModelViewSet`` is the read-open, write-guarded base; ``ServiceRecordViewSet`` adds the
service-backed writes every masterdata directory resource shares: create, update and soft delete
through a service (never the serializer), ``?hard=true`` hard delete (needs
``masterdata.hard_delete``), ``POST …/restore``, and permission codes per action.
"""

from __future__ import annotations

from typing import Any, ClassVar

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets.platform import PlatformScopedViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.masterdata.api.viewsets.gating import GatedQueryMixin, GatedSearchFilter
from apps.masterdata.constants.permissions import MasterdataPermissions
from apps.masterdata.constants.permissions import MasterdataPermissions as P
from apps.masterdata.permissions import AliasAwareHasPermission
from apps.masterdata.services.directory import DirectoryService

_TRUE = {"1", "true", "yes"}
_FALSE = {"", "0", "false", "no"}
_READS = ("list", "retrieve")


class GlobalDirectoryGuard:
    """Open reads, ``masterdata.directory.manage`` for writes (the legacy code still counts)."""

    permission_classes = (
        IsAuthenticatedPermission,
        AliasAwareHasPermission,
    )

    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (MasterdataPermissions.DIRECTORY_MANAGE,),
        "update": (MasterdataPermissions.DIRECTORY_MANAGE,),
        "partial_update": (MasterdataPermissions.DIRECTORY_MANAGE,),
        "destroy": (MasterdataPermissions.DIRECTORY_MANAGE,),
    }


class DirectoryModelViewSet(
    GatedQueryMixin,
    GlobalDirectoryGuard,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    PlatformScopedViewSet,
):
    filter_backends = [DjangoFilterBackend, GatedSearchFilter, filters.OrderingFilter]
    ordering = ["name"]
    pagination_class = StandardPagination


class ServiceRecordViewSet(DirectoryModelViewSet):
    service_class: type[DirectoryService[Any]]
    #: Name of the owner FK for contacts and contracts; ``None`` for clients and vendors.
    parent_field: ClassVar[str | None] = None
    #: Permissions: reads, and writes (``HARD_DELETE`` is added for ``?hard=true``).
    read_permissions: ClassVar[tuple[str, ...]] = ()
    write_permissions: ClassVar[tuple[str, ...]] = (P.DIRECTORY_MANAGE,)
    #: Actions beyond create/update/destroy/restore that need the write permissions.
    extra_write_actions: ClassVar[tuple[str, ...]] = ()
    refuse_status_on_update: ClassVar[bool] = False
    filter_backends = [DjangoFilterBackend, GatedSearchFilter, filters.OrderingFilter]

    # ---- permissions -----------------------------------------------------

    def _hard_requested(self) -> bool:
        return self.request.query_params.get("hard", "").strip().lower() in _TRUE

    def get_permission_required(self):
        action_name = getattr(self, "action", None)
        if not action_name:
            return ()
        if action_name in _READS:
            return self.read_permissions
        writes = (
            "create",
            "update",
            "partial_update",
            "destroy",
            "restore",
            *self.extra_write_actions,
        )
        if action_name not in writes:
            return None  # unmapped actions are denied
        if action_name == "destroy" and self._hard_requested():
            return (*self.write_permissions, P.HARD_DELETE)
        return self.write_permissions

    # ---- queryset --------------------------------------------------------

    def get_queryset(self):
        selector = self.get_selector()
        needs_deleted = self.action == "restore" or (
            self.action == "destroy" and self._hard_requested()
        )
        queryset = (
            selector.with_deleted()
            if needs_deleted
            else selector.get_queryset(request=self.request, view=self)
        )
        return selector.scope_by_request(queryset, request=self.request, view=self)

    def present(self, obj):
        """Re-read ``obj`` through the selector so annotations (contact_count) are present."""
        return self.get_queryset().get(pk=obj.pk)

    # ---- writes go through the service ----------------------------------

    def perform_create(self, serializer):
        data = dict(serializer.validated_data)
        parent = data.pop(self.parent_field, None) if self.parent_field else None
        created = self.service_class.create(actor=self.request.user, data=data, parent=parent)
        serializer.instance = self.present(created)

    def perform_update(self, serializer):
        data = dict(serializer.validated_data)
        if self.parent_field:
            data.pop(
                self.parent_field, None
            )  # immutable; the serializer already checked it is unchanged
        updated = self.service_class.update(
            actor=self.request.user, instance=serializer.instance, data=data
        )
        serializer.instance = self.present(updated)

    def update(self, request, *args, **kwargs):
        if (
            self.refuse_status_on_update
            and hasattr(request.data, "keys")
            and "status" in request.data
        ):
            raise serializers.ValidationError(
                {"status": ["Read-only. Use POST …/activate or …/terminate to change it."]}
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        hard = request.query_params.get("hard", "").strip().lower()
        if hard not in _TRUE | _FALSE:
            raise serializers.ValidationError({"hard": ["Use hard=true or omit it."]})
        instance = self.get_object()
        if hard in _TRUE:
            self.service_class.hard_delete(actor=request.user, instance=instance)
        else:
            self.service_class.soft_delete(actor=request.user, instance=instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        restored = self.service_class.restore(actor=request.user, instance=self.get_object())
        return Response(self.get_serializer(self.present(restored)).data)
