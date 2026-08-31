from django.http import Http404
from django.shortcuts import get_object_or_404

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.organization.api.serializers.client import ClientCreateSerializer, ClientDetailSerializer, ClientListSerializer, ClientUpdateSerializer
from apps.organization.constants.permissions import OrganizationPermissions
from apps.organization.models import Client
from apps.organization.selectors.base import OrganizationBaseSelector


class ClientViewSet(ServiceModelViewSet):
    queryset = Client.objects.all()
    serializer_map = {
        "list": ClientListSerializer,
        "retrieve": ClientDetailSerializer,
        "create": ClientCreateSerializer,
        "update": ClientUpdateSerializer,
        "partial_update": ClientUpdateSerializer,
    }
    permission_classes = (IsAuthenticatedPermission, HasPermission)
    permission_map = {
        "list": (OrganizationPermissions.VIEW,),
        "retrieve": (OrganizationPermissions.VIEW,),
        "create": (OrganizationPermissions.CREATE,),
        "update": (OrganizationPermissions.UPDATE,),
        "partial_update": (OrganizationPermissions.UPDATE,),
        "destroy": (OrganizationPermissions.DELETE,),
    }
    pagination_class = StandardPagination
    search_fields = ("name", "code", "contact_name")
    filterset_fields = ("status", "studio_type")
    ordering_fields = ("name", "code", "created_at")

    def get_queryset(self):
        qs = Client.objects.select_related("organization").all()
        # Scope by organization header
        org_id = self.request.headers.get("X-Organization-Id") or self.request.headers.get("X-Organization") or getattr(self.request, "organization", None)
        if org_id:
            try:
                pk = org_id.id if hasattr(org_id, "id") else org_id
                qs = qs.filter(organization_id=pk)
            except Exception:
                pass
        return qs

    def get_object(self):
        """
        Override to support both UUID and code lookup.
        """
        from django.core.exceptions import ValidationError

        queryset = self.filter_queryset(self.get_queryset())

        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_value = self.kwargs[lookup_url_kwarg]

        # Try UUID lookup first
        filter_kwargs = {"id": lookup_value}
        try:
            obj = get_object_or_404(queryset, **filter_kwargs)
            self.check_object_permissions(self.request, obj)
            return obj
        except (Http404, ValidationError):
            pass

        # Try code lookup
        filter_kwargs = {"code__iexact": lookup_value}
        obj = queryset.filter(**filter_kwargs).first()
        if obj:
            self.check_object_permissions(self.request, obj)
            return obj

        raise Http404

    def perform_create(self, serializer):
        org = getattr(self.request, "organization", None)
        if not org:
            org_id = self.request.headers.get("X-Organization-Id")
            if org_id:
                from apps.organization.models import Organization
                try:
                    org = Organization.objects.get(pk=org_id)
                except Exception:
                    pass
        if not org:
            from apps.organization.models import Organization
            org = Organization.objects.first()
        serializer.save(organization=org)


