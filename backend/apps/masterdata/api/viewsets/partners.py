"""
Client, vendor, contact and contract viewsets (docs/masterdata/CONTRACTS.md §4).

Every write goes through a service; the views only adapt HTTP. Differences from
the other directory viewsets:

* Contacts are **purely sensitive**: every action needs
  ``masterdata.person.view_sensitive``, checked before any object lookup, so a
  missing id and a forbidden id both answer 403. Writes also need
  ``masterdata.directory.manage``.
* Clients, vendors and contracts are **mixed**: ordinary fields for everyone,
  personal data and financial values omitted without their permission.
* ``DELETE`` is a soft delete (204); ``?hard=true`` needs
  ``masterdata.hard_delete`` and an already soft-deleted row; ``POST …/restore``
  undoes a soft delete.
* A contract's ``status`` is derived and cannot be sent on PUT/PATCH; its
  lifecycle moves through ``activate``, ``terminate`` and ``adjust-end-date``.
"""

from __future__ import annotations

from typing import Any, ClassVar

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.masterdata.api.filtersets.contracts import ClientContractFilter, VendorContractFilter
from apps.masterdata.api.serializers.directory import (
    AdjustEndDateSerializer,
    ClientContactSerializer,
    ClientContractSerializer,
    ClientSerializer,
    VendorContactSerializer,
    VendorContractSerializer,
    VendorSerializer,
)
from apps.masterdata.api.viewsets.directory import DirectoryModelViewSet
from apps.masterdata.api.viewsets.gating import GatedSearchFilter
from apps.masterdata.constants.permissions import MasterdataPermissions as P
from apps.masterdata.selectors.directory import (
    ClientContactSelector,
    ClientContractSelector,
    ClientSelector,
    VendorContactSelector,
    VendorContractSelector,
    VendorSelector,
)
from apps.masterdata.services.contact import ClientContactService, VendorContactService
from apps.masterdata.services.contract import ClientContractService, VendorContractService
from apps.masterdata.services.directory import DirectoryService
from apps.masterdata.services.partner import ClientService, VendorService

_TRUE = {"1", "true", "yes"}
_FALSE = {"", "0", "false", "no"}
_READS = ("list", "retrieve")


class PartnerRecordViewSet(DirectoryModelViewSet):
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


class ClientViewSet(PartnerRecordViewSet):
    serializer_class = ClientSerializer
    selector_class = ClientSelector
    service_class = ClientService
    filterset_fields = ["status", "studio_type"]
    search_fields = ["name", "code", "contact_name"]
    ordering_fields = ["name", "code", "created_at"]
    gated_query_fields = {
        P.PERSON_VIEW_SENSITIVE: ("contact_name", "email", "phone"),
        P.CLIENT_VIEW_FINANCIAL: ("total_billed_usd",),
    }


class VendorViewSet(PartnerRecordViewSet):
    serializer_class = VendorSerializer
    selector_class = VendorSelector
    service_class = VendorService
    filterset_fields = ["status", "specialization"]
    search_fields = ["name", "code", "contact_name"]
    ordering_fields = ["name", "code", "created_at"]
    gated_query_fields = {P.PERSON_VIEW_SENSITIVE: ("contact_name", "email")}


class _ContactViewSet(PartnerRecordViewSet):
    """Purely sensitive: nothing here is readable or writable without the permission."""

    read_permissions = (P.PERSON_VIEW_SENSITIVE,)
    write_permissions = (P.DIRECTORY_MANAGE, P.PERSON_VIEW_SENSITIVE)
    search_fields = ["name", "email"]
    ordering_fields = ["name", "created_at"]


class ClientContactViewSet(_ContactViewSet):
    serializer_class = ClientContactSerializer
    selector_class = ClientContactSelector
    service_class = ClientContactService
    parent_field = "client"
    filterset_fields = ["client", "is_primary"]


class VendorContactViewSet(_ContactViewSet):
    serializer_class = VendorContactSerializer
    selector_class = VendorContactSelector
    service_class = VendorContactService
    parent_field = "vendor"
    filterset_fields = ["vendor", "is_primary"]


class _ContractViewSet(PartnerRecordViewSet):
    refuse_status_on_update = True
    extra_write_actions = ("activate", "terminate", "adjust_end_date")
    search_fields = ["contract_number", "title"]
    ordering_fields = ["contract_number", "created_at"]
    ordering = ["contract_number"]

    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, *args, **kwargs):
        contract = self.service_class.activate(actor=request.user, contract=self.get_object())  # pyright: ignore[reportAttributeAccessIssue]
        return Response(self.get_serializer(self.present(contract)).data)

    @action(detail=True, methods=["post"], url_path="terminate")
    def terminate(self, request, *args, **kwargs):
        contract = self.service_class.terminate(actor=request.user, contract=self.get_object())  # pyright: ignore[reportAttributeAccessIssue]
        return Response(self.get_serializer(self.present(contract)).data)

    @action(detail=True, methods=["post"], url_path="adjust-end-date")
    def adjust_end_date(self, request, *args, **kwargs):
        body = AdjustEndDateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        contract = self.service_class.adjust_end_date(  # pyright: ignore[reportAttributeAccessIssue]
            actor=request.user,
            contract=self.get_object(),
            expiry_date=body.validated_data["expiry_date"],
        )
        return Response(self.get_serializer(self.present(contract)).data)


class ClientContractViewSet(_ContractViewSet):
    serializer_class = ClientContractSerializer
    selector_class = ClientContractSelector
    service_class = ClientContractService
    parent_field = "client"
    filterset_class = ClientContractFilter
    gated_query_fields = {P.CLIENT_VIEW_FINANCIAL: ("value_usd",)}


class VendorContractViewSet(_ContractViewSet):
    serializer_class = VendorContractSerializer
    selector_class = VendorContractSelector
    service_class = VendorContractService
    parent_field = "vendor"
    filterset_class = VendorContractFilter
    gated_query_fields = {P.CLIENT_VIEW_FINANCIAL: ("total_value_usd",)}
