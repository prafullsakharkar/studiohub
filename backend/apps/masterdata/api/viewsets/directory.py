"""
Global directory viewsets (org-removal B3).

Flat platform-global CRUD for departments, teams, offices, positions,
people, clients, vendors (+ contacts/contracts). Reads are open to every
authenticated user (shared reference data); writes require the
platform-level ``platform.master_data.configure`` grant. Responses are
paginated to match the frontend contract.
"""

from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets.platform import PlatformScopedViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.masterdata.api.serializers.directory import (
    ClientContactSerializer,
    ClientContractSerializer,
    ClientSerializer,
    DepartmentSerializer,
    OfficeSerializer,
    PersonSerializer,
    PositionSerializer,
    TeamSerializer,
    VendorContactSerializer,
    VendorContractSerializer,
    VendorSerializer,
)
from apps.masterdata.selectors.directory import (
    ClientContactSelector,
    ClientContractSelector,
    ClientSelector,
    DepartmentSelector,
    OfficeSelector,
    PersonSelector,
    PositionSelector,
    TeamSelector,
    VendorContactSelector,
    VendorContractSelector,
    VendorSelector,
)
from apps.platform.constants.permissions import PlatformMasterDataPermissions


class GlobalDirectoryGuard:
    """Open reads, platform-gated writes for global directory records."""

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (PlatformMasterDataPermissions.CONFIGURE,),
        "update": (PlatformMasterDataPermissions.CONFIGURE,),
        "partial_update": (PlatformMasterDataPermissions.CONFIGURE,),
        "destroy": (PlatformMasterDataPermissions.CONFIGURE,),
    }


class DirectoryModelViewSet(
    GlobalDirectoryGuard,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    PlatformScopedViewSet,
):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    ordering = ["name"]
    pagination_class = StandardPagination


class DepartmentViewSet(DirectoryModelViewSet):
    serializer_class = DepartmentSerializer
    selector_class = DepartmentSelector
    filterset_fields = ["department_type", "parent"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code", "created_at"]


class TeamViewSet(DirectoryModelViewSet):
    serializer_class = TeamSerializer
    selector_class = TeamSelector
    filterset_fields = ["department"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code", "created_at"]


class OfficeViewSet(DirectoryModelViewSet):
    serializer_class = OfficeSerializer
    selector_class = OfficeSelector
    filterset_fields = ["country", "city", "is_active", "is_headquarters"]
    search_fields = ["name", "code", "city"]
    ordering_fields = ["name", "code", "created_at"]


class PositionViewSet(DirectoryModelViewSet):
    serializer_class = PositionSerializer
    selector_class = PositionSelector
    filterset_fields = ["department", "is_managerial"]
    search_fields = ["name", "code"]
    ordering_fields = ["level", "name", "created_at"]


class PersonViewSet(DirectoryModelViewSet):
    serializer_class = PersonSerializer
    selector_class = PersonSelector
    filterset_fields = ["status", "department", "team", "office"]
    search_fields = ["name", "email"]
    ordering_fields = ["name", "created_at"]


class ClientViewSet(DirectoryModelViewSet):
    serializer_class = ClientSerializer
    selector_class = ClientSelector
    filterset_fields = ["status", "studio_type"]
    search_fields = ["name", "code", "contact_name"]
    ordering_fields = ["name", "code", "created_at"]


class VendorViewSet(DirectoryModelViewSet):
    serializer_class = VendorSerializer
    selector_class = VendorSelector
    filterset_fields = ["status", "specialization"]
    search_fields = ["name", "code", "contact_name"]
    ordering_fields = ["name", "code", "created_at"]


class ClientContactViewSet(DirectoryModelViewSet):
    serializer_class = ClientContactSerializer
    selector_class = ClientContactSelector
    filterset_fields = ["client", "is_primary"]
    search_fields = ["name", "email"]
    ordering_fields = ["name", "created_at"]


class ClientContractViewSet(DirectoryModelViewSet):
    serializer_class = ClientContractSerializer
    selector_class = ClientContractSelector
    filterset_fields = ["client", "status", "type"]
    search_fields = ["contract_number", "title"]
    ordering_fields = ["contract_number", "created_at"]


class VendorContactViewSet(DirectoryModelViewSet):
    serializer_class = VendorContactSerializer
    selector_class = VendorContactSelector
    filterset_fields = ["vendor", "is_primary"]
    search_fields = ["name", "email"]
    ordering_fields = ["name", "created_at"]


class VendorContractViewSet(DirectoryModelViewSet):
    serializer_class = VendorContractSerializer
    selector_class = VendorContractSelector
    filterset_fields = ["vendor", "status", "type"]
    search_fields = ["contract_number", "title"]
    ordering_fields = ["contract_number", "created_at"]
