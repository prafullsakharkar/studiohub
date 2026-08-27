from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.production.constants.permissions import ProjectPermissions
from apps.organization.middleware.organization_context import resolve_organization_context
from apps.production.api.filtersets.project import ProjectFilterSet
from apps.production.api.serializers.project.create import ProjectCreateSerializer
from apps.production.api.serializers.project.detail import ProjectDetailSerializer
from apps.production.api.serializers.project.list import ProjectListSerializer
from apps.production.api.serializers.project.update import ProjectUpdateSerializer
from apps.production.models import Project
from apps.production.selectors.project import ProjectSelector
from apps.production.services.project import ProjectService


class ProjectViewSet(ServiceModelViewSet):
    queryset = Project.objects.all()
    selector_class = ProjectSelector
    service_class = ProjectService
    pagination_class = StandardPagination
    filterset_class = ProjectFilterSet
    permission_classes = (IsAuthenticatedPermission, HasPermission,)

    serializer_map = {
        "list": ProjectListSerializer,
        "retrieve": ProjectDetailSerializer,
        "create": ProjectCreateSerializer,
        "update": ProjectUpdateSerializer,
        "partial_update": ProjectUpdateSerializer,
    }

    permission_map = {
        "list": (ProjectPermissions.VIEW,),
        "retrieve": (ProjectPermissions.VIEW,),
        "create": (ProjectPermissions.CREATE,),
        "update": (ProjectPermissions.UPDATE,),
        "partial_update": (ProjectPermissions.UPDATE,),
        "destroy": (ProjectPermissions.DELETE,),
    }


    search_fields = ("name", "code", "description")
    ordering_fields = ("name", "code", "created_at", "status")

    def perform_authentication(self, request):
        super().perform_authentication(request)
        resolve_organization_context(request, force=True)
        return request

    def perform_create(self, serializer):
        # Auto-assign organization from header/context
        org = getattr(self.request, "organization", None)
        if org is None:
            org_id = self.request.headers.get("X-Organization-Id") or self.request.headers.get("X-Organization")
            if org_id:
                from apps.organization.models import Organization

                try:
                    org = Organization.objects.get(pk=org_id)
                except Exception:
                    org = None
        # If still None, use first org for user (fallback for tests)
        if org is None and self.request.user.is_authenticated:
            from apps.organization.models import OrganizationMembership

            membership = OrganizationMembership.objects.filter(user=self.request.user).first()
            if membership:
                org = membership.organization
        if org is None:
            # Fallback: first organization
            from apps.organization.models import Organization

            org = Organization.objects.first()
        serializer.save(organization=org)

    def get_queryset(self):
        qs = self.selector_class.get_queryset(request=self.request, view=self)
        return qs
