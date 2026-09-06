"""
Contract ViewSets.

Nested resources under legacy clients/vendors:

    /api/v1/clients/{client_pk}/contracts/
    /api/v1/vendors/{vendor_pk}/contracts/
"""

from django.http import Http404

from apps.core.api.pagination import StandardPagination
from apps.organization.api.filtersets.client_contract import ClientContractFilterSet
from apps.organization.api.filtersets.vendor_contract import VendorContractFilterSet
from apps.organization.api.serializers.client_contract import (
    ClientContractCreateSerializer,
    ClientContractDetailSerializer,
    ClientContractListSerializer,
    ClientContractUpdateSerializer,
)
from apps.organization.api.serializers.vendor_contract import (
    VendorContractCreateSerializer,
    VendorContractDetailSerializer,
    VendorContractListSerializer,
    VendorContractUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.api.viewsets.nested_bulk import NestedBulkActionsMixin
from apps.organization.constants.permissions import OrganizationPermissions
from apps.organization.models import Client, Vendor
from apps.organization.selectors.contract import (
    ClientContractSelector,
    VendorContractSelector,
)
from apps.organization.services.client_contract import ClientContractService
from apps.organization.services.vendor_contract import VendorContractService


class ClientContractViewSet(NestedBulkActionsMixin, OrganizationEntityViewSet):
    """
    Client contracts scoped to a parent client.

    Organization and client are derived server-side from the URL parent
    and the resolved request context — never from the payload.
    """

    parent_accessor = "_get_parent_client"
    parent_field = "client"
    detail_serializer_class = ClientContractDetailSerializer
    create_serializer_class = ClientContractCreateSerializer
    update_serializer_class = ClientContractUpdateSerializer

    selector_class = ClientContractSelector

    service_class = ClientContractService

    filterset_class = ClientContractFilterSet

    # Client contracts have neither ``code`` nor ``name`` fields (base defaults).
    search_fields = (
        "contract_number",
        "title",
    )

    ordering = ("contract_number",)

    ordering_fields = (
        "contract_number",
        "title",
        "type",
        "status",
        "created_at",
        "updated_at",
    )

    pagination_class = StandardPagination

    serializer_map = {
        "list": ClientContractListSerializer,
        "retrieve": ClientContractDetailSerializer,
        "create": ClientContractCreateSerializer,
        "update": ClientContractUpdateSerializer,
        "partial_update": ClientContractUpdateSerializer,
    }

    permission_map = {
        "list": (OrganizationPermissions.VIEW,),
        "retrieve": (OrganizationPermissions.VIEW,),
        "create": (OrganizationPermissions.CREATE,),
        "update": (OrganizationPermissions.UPDATE,),
        "partial_update": (OrganizationPermissions.UPDATE,),
        "destroy": (OrganizationPermissions.DELETE,),
        "bulk_create": (OrganizationPermissions.CREATE,),
        "bulk_update": (OrganizationPermissions.UPDATE,),
        "bulk_archive": (OrganizationPermissions.DELETE,),
        "bulk_restore": (OrganizationPermissions.UPDATE,),
        "restore": (OrganizationPermissions.UPDATE,),
    }

    def get_queryset(self):
        qs = super().get_queryset()

        client_pk = self.kwargs.get("client_pk")
        if client_pk:
            qs = qs.filter(client__id=client_pk)

        return qs

    def _get_parent_client(self):
        """
        Resolve the parent client from the URL.

        Non-staff lookups are scoped to the request's organization so a
        user can never attach contracts to another organization's client.
        """
        client_pk = self.kwargs.get("client_pk")
        if not client_pk:
            return None

        qs = Client.objects.all()

        user = getattr(self.request, "user", None)
        organization = getattr(self.request, "organization", None)

        if organization is not None and not (
            user is not None and (user.is_staff or user.is_superuser)
        ):
            qs = qs.filter(organization=organization)

        return qs.filter(id=client_pk).first()

    def perform_create(self, serializer):
        client = self._get_parent_client()

        if client is None:
            raise Http404

        serializer.validated_data["client"] = client
        serializer.validated_data["organization"] = (
            client.organization
            if client
            else getattr(self.request, "organization", None)
        )
        super().perform_create(serializer)


class VendorContractViewSet(NestedBulkActionsMixin, OrganizationEntityViewSet):
    """
    Vendor contracts scoped to a parent vendor.

    Organization and vendor are derived server-side from the URL parent
    and the resolved request context — never from the payload.
    """

    parent_accessor = "_get_parent_vendor"
    parent_field = "vendor"
    detail_serializer_class = VendorContractDetailSerializer
    create_serializer_class = VendorContractCreateSerializer
    update_serializer_class = VendorContractUpdateSerializer

    selector_class = VendorContractSelector

    service_class = VendorContractService

    filterset_class = VendorContractFilterSet

    # Vendor contracts have neither ``code`` nor ``name`` fields (base defaults).
    search_fields = (
        "contract_number",
        "title",
    )

    ordering = ("contract_number",)

    ordering_fields = (
        "contract_number",
        "title",
        "type",
        "status",
        "created_at",
        "updated_at",
    )

    pagination_class = StandardPagination

    serializer_map = {
        "list": VendorContractListSerializer,
        "retrieve": VendorContractDetailSerializer,
        "create": VendorContractCreateSerializer,
        "update": VendorContractUpdateSerializer,
        "partial_update": VendorContractUpdateSerializer,
    }

    permission_map = {
        "list": (OrganizationPermissions.VIEW,),
        "retrieve": (OrganizationPermissions.VIEW,),
        "create": (OrganizationPermissions.CREATE,),
        "update": (OrganizationPermissions.UPDATE,),
        "partial_update": (OrganizationPermissions.UPDATE,),
        "destroy": (OrganizationPermissions.DELETE,),
        "bulk_create": (OrganizationPermissions.CREATE,),
        "bulk_update": (OrganizationPermissions.UPDATE,),
        "bulk_archive": (OrganizationPermissions.DELETE,),
        "bulk_restore": (OrganizationPermissions.UPDATE,),
        "restore": (OrganizationPermissions.UPDATE,),
    }

    def get_queryset(self):
        qs = super().get_queryset()

        vendor_pk = self.kwargs.get("vendor_pk")
        if vendor_pk:
            qs = qs.filter(vendor__id=vendor_pk)

        return qs

    def _get_parent_vendor(self):
        """
        Resolve the parent vendor from the URL.

        Non-staff lookups are scoped to the request's organization so a
        user can never attach contracts to another organization's vendor.
        """
        vendor_pk = self.kwargs.get("vendor_pk")
        if not vendor_pk:
            return None

        qs = Vendor.objects.all()

        user = getattr(self.request, "user", None)
        organization = getattr(self.request, "organization", None)

        if organization is not None and not (
            user is not None and (user.is_staff or user.is_superuser)
        ):
            qs = qs.filter(organization=organization)

        return qs.filter(id=vendor_pk).first()

    def perform_create(self, serializer):
        vendor = self._get_parent_vendor()

        if vendor is None:
            raise Http404

        serializer.validated_data["vendor"] = vendor
        serializer.validated_data["organization"] = (
            vendor.organization
            if vendor
            else getattr(self.request, "organization", None)
        )
        super().perform_create(serializer)
