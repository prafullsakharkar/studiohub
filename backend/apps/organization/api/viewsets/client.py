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

    def get_object(self):
        # Support id-or-code lookup (code__iexact)
        lookup = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        qs = self.get_queryset()
        try:
            obj = qs.filter(id=lookup).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        except Exception:
            pass
        obj = qs.filter(code__iexact=lookup).first()
        if obj:
            self.check_object_permissions(self.request, obj)
            return obj
        from django.http import Http404
        raise Http404
