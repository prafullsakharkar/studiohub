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

from drf_spectacular.utils import extend_schema
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
from apps.masterdata.api.viewsets.records import ServiceRecordViewSet
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
from apps.masterdata.services.partner import ClientService, VendorService

_TRUE = {"1", "true", "yes"}
_FALSE = {"", "0", "false", "no"}
_READS = ("list", "retrieve")


class ClientViewSet(ServiceRecordViewSet):
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


class VendorViewSet(ServiceRecordViewSet):
    serializer_class = VendorSerializer
    selector_class = VendorSelector
    service_class = VendorService
    filterset_fields = ["status", "specialization"]
    search_fields = ["name", "code", "contact_name"]
    ordering_fields = ["name", "code", "created_at"]
    gated_query_fields = {P.PERSON_VIEW_SENSITIVE: ("contact_name", "email")}


class _ContactViewSet(ServiceRecordViewSet):
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


class _ContractViewSet(ServiceRecordViewSet):
    refuse_status_on_update = True
    extra_write_actions = ("activate", "terminate", "adjust_end_date")
    search_fields = ["contract_number", "title"]
    ordering_fields = ["contract_number", "created_at"]
    ordering = ["contract_number"]

    @extend_schema(request=None)
    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, *args, **kwargs):
        contract = self.service_class.activate(actor=request.user, contract=self.get_object())  # pyright: ignore[reportAttributeAccessIssue]
        return Response(self.get_serializer(self.present(contract)).data)

    @extend_schema(request=None)
    @action(detail=True, methods=["post"], url_path="terminate")
    def terminate(self, request, *args, **kwargs):
        contract = self.service_class.terminate(actor=request.user, contract=self.get_object())  # pyright: ignore[reportAttributeAccessIssue]
        return Response(self.get_serializer(self.present(contract)).data)

    @extend_schema(request=AdjustEndDateSerializer)
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
