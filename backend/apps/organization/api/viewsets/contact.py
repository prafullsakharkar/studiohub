"""
Contact ViewSets.

Nested resources under legacy clients/vendors:

    /api/v1/clients/{client_pk}/contacts/
    /api/v1/vendors/{vendor_pk}/contacts/
"""

from django.http import Http404

from apps.core.api.pagination import StandardPagination
from apps.organization.api.filtersets.client_contact import ClientContactFilterSet
from apps.organization.api.filtersets.vendor_contact import VendorContactFilterSet
from apps.organization.api.serializers.client_contact import (
    ClientContactCreateSerializer,
    ClientContactDetailSerializer,
    ClientContactListSerializer,
    ClientContactUpdateSerializer,
)
from apps.organization.api.serializers.vendor_contact import (
    VendorContactCreateSerializer,
    VendorContactDetailSerializer,
    VendorContactListSerializer,
    VendorContactUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.constants.permissions import OrganizationPermissions
from apps.organization.models import Client, Vendor
from apps.organization.selectors.contact import (
    ClientContactSelector,
    VendorContactSelector,
)
from apps.organization.services.client_contact import ClientContactService
from apps.organization.services.vendor_contact import VendorContactService


class ClientContactViewSet(OrganizationEntityViewSet):
    """
    Client contacts scoped to a parent client.

    Organization and client are derived server-side from the URL parent
    and the resolved request context — never from the payload.
    """

    selector_class = ClientContactSelector

    service_class = ClientContactService

    filterset_class = ClientContactFilterSet

    # Client contacts have no ``code`` field (base default).
    search_fields = (
        "name",
        "email",
        "role",
    )

    pagination_class = StandardPagination

    serializer_map = {
        "list": ClientContactListSerializer,
        "retrieve": ClientContactDetailSerializer,
        "create": ClientContactCreateSerializer,
        "update": ClientContactUpdateSerializer,
        "partial_update": ClientContactUpdateSerializer,
    }

    permission_map = {
        "list": (OrganizationPermissions.VIEW,),
        "retrieve": (OrganizationPermissions.VIEW,),
        "create": (OrganizationPermissions.CREATE,),
        "update": (OrganizationPermissions.UPDATE,),
        "partial_update": (OrganizationPermissions.UPDATE,),
        "destroy": (OrganizationPermissions.DELETE,),
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
        user can never attach contacts to another organization's client.
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


class VendorContactViewSet(OrganizationEntityViewSet):
    """
    Vendor contacts scoped to a parent vendor.

    Organization and vendor are derived server-side from the URL parent
    and the resolved request context — never from the payload.
    """

    selector_class = VendorContactSelector

    service_class = VendorContactService

    filterset_class = VendorContactFilterSet

    # Vendor contacts have no ``code`` field (base default).
    search_fields = (
        "name",
        "email",
        "role",
    )

    pagination_class = StandardPagination

    serializer_map = {
        "list": VendorContactListSerializer,
        "retrieve": VendorContactDetailSerializer,
        "create": VendorContactCreateSerializer,
        "update": VendorContactUpdateSerializer,
        "partial_update": VendorContactUpdateSerializer,
    }

    permission_map = {
        "list": (OrganizationPermissions.VIEW,),
        "retrieve": (OrganizationPermissions.VIEW,),
        "create": (OrganizationPermissions.CREATE,),
        "update": (OrganizationPermissions.UPDATE,),
        "partial_update": (OrganizationPermissions.UPDATE,),
        "destroy": (OrganizationPermissions.DELETE,),
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
        user can never attach contacts to another organization's vendor.
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
