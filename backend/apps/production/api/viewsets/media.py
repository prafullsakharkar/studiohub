from rest_framework.response import Response
from apps.core.api.viewsets import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.production.constants.permissions import MediaPermissions
from apps.organization.middleware.organization_context import resolve_organization_context
from apps.production.api.serializers.media.create import MediaCreateSerializer
from apps.production.api.serializers.media.detail import MediaDetailSerializer
from apps.production.api.serializers.media.list import MediaListSerializer
from apps.production.api.serializers.media.update import MediaUpdateSerializer
from apps.production.models import Media
from apps.production.selectors.media import MediaSelector
from apps.production.services.media import MediaService

class MediaViewSet(ServiceModelViewSet):
    queryset = Media.objects.all()
    selector_class = MediaSelector
    service_class = MediaService
    pagination_class = None
    permission_classes = (IsAuthenticatedPermission, HasPermission,)
    serializer_map = {
        "list": MediaListSerializer,
        "retrieve": MediaDetailSerializer,
        "create": MediaCreateSerializer,
        "update": MediaUpdateSerializer,
        "partial_update": MediaUpdateSerializer,
    }

    permission_map = {
        "list": (MediaPermissions.VIEW,),
        "retrieve": (MediaPermissions.VIEW,),
        "create": (MediaPermissions.CREATE,),
        "update": (MediaPermissions.UPDATE,),
        "partial_update": (MediaPermissions.UPDATE,),
        "destroy": (MediaPermissions.DELETE,),
    }

    search_fields = ("category",)
    filterset_fields = ("media_type", "project", "entity_type", "entity_id")
    ordering_fields = ("created_at",)

    def perform_authentication(self, request):
        super().perform_authentication(request)
        resolve_organization_context(request, force=True)
        return request

    def perform_create(self, serializer):
        org = getattr(self.request, "organization", None)
        if org is None:
            org_id = self.request.headers.get("X-Organization-Id")
            if org_id:
                from apps.organization.models import Organization
                try:
                    org = Organization.objects.get(pk=org_id)
                except Exception:
                    pass
        if org is None and self.request.user.is_authenticated:
            from apps.organization.models import OrganizationMembership
            m = OrganizationMembership.objects.filter(user=self.request.user).first()
            if m:
                org = m.organization
        if org is None:
            from apps.organization.models import Organization
            org = Organization.objects.first()
        serializer.save(organization=org)
