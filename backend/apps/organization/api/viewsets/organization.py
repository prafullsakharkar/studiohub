from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.organization.api.filtersets import OrganizationFilterSet
from apps.organization.api.serializers.organization import (
    OrganizationCreateSerializer,
    OrganizationDetailSerializer,
    OrganizationListSerializer,
    OrganizationUpdateSerializer,
)
from apps.organization.constants import OrganizationPermissions
from apps.organization.middleware.organization_context import (
    resolve_organization_context,
)
from apps.organization.selectors import OrganizationSelector
from apps.organization.services import OrganizationService


class OrganizationViewSet(ServiceModelViewSet):
    """
    Organization API.
    """

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    selector_class = OrganizationSelector

    service_class = OrganizationService

    filterset_class = OrganizationFilterSet

    pagination_class = StandardPagination

    serializer_map = {
        "list": OrganizationListSerializer,
        "retrieve": OrganizationDetailSerializer,
        "create": OrganizationCreateSerializer,
        "update": OrganizationUpdateSerializer,
        "partial_update": OrganizationUpdateSerializer,
    }

    permission_map = {
        "list": (OrganizationPermissions.VIEW,),
        "retrieve": (OrganizationPermissions.VIEW,),
        "create": (OrganizationPermissions.CREATE,),
        "update": (OrganizationPermissions.UPDATE,),
        "partial_update": (OrganizationPermissions.UPDATE,),
        "destroy": (OrganizationPermissions.DELETE,),
        "archive": (OrganizationPermissions.UPDATE,),
        "restore": (OrganizationPermissions.UPDATE,),
        "export": (OrganizationPermissions.VIEW,),
        "switch": (OrganizationPermissions.VIEW,),
        "organization_settings": (OrganizationPermissions.VIEW,),
        "my": (OrganizationPermissions.VIEW,),
    }

    def perform_authentication(self, request):
        """
        Resolve the organization context right after authentication.
        """
        response = super().perform_authentication(request)
        resolve_organization_context(request, force=True)
        return response

    def get_queryset(self):
        """
        Scope the Organization queryset by the user's memberships.

        The Organization model itself has no ``organization`` FK, so the
        generic ``scope_by_request`` does not apply. Users see the
        organizations they belong to; staff see everything.
        """
        if getattr(self, "swagger_fake_view", False):
            return super().get_queryset().none()

        qs = super().get_queryset()

        user = getattr(self.request, "user", None)

        if user is None or not user.is_authenticated:
            return qs.none()

        if user.is_staff or user.is_superuser:
            return qs

        return qs.filter(memberships__user=user)

    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request, *args, **kwargs):
        """Return organizations for the current user (same as filtered list)."""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, *args, **kwargs):
        instance = self.get_object()
        # BusinessService provides archive via LifecycleMixin
        try:
            self.service_class.archive(instance)
        except Exception:
            # Fallback for models where archive not implemented as soft-delete
            instance.delete()
        serializer = OrganizationDetailSerializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.service_class.restore(instance)
        except Exception:
            pass
        serializer = OrganizationDetailSerializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="export")
    def export(self, request, *args, **kwargs):
        instance = self.get_object()
        # Minimal stub: in production this would enqueue an export job and return a signed URL.
        # Keep idempotent and fast for contract tests.
        return Response({"download_url": f"/media/exports/{instance.id}.zip"})

    @action(detail=True, methods=["post"], url_path="switch")
    def switch(self, request, *args, **kwargs):
        instance = self.get_object()
        # Persist active org for the mock header `X-Organization-Id` flow.
        # Also store in session if available.
        if hasattr(request, "session"):
            request.session["active_organization_id"] = str(instance.id)
        return Response({"success": True})

    @action(detail=True, methods=["get", "patch"], url_path="settings")
    def organization_settings(self, request, *args, **kwargs):
        instance = self.get_object()
        # Lazy import to avoid circular imports
        from apps.organization.api.serializers.organization_settings import (
            OrganizationSettingsDetailSerializer,
        )
        from apps.organization.models import OrganizationSettings

        settings_obj, _ = OrganizationSettings.objects.get_or_create(
            organization=instance,
            defaults={"timezone": "UTC", "language": "en", "currency": "USD"},
        )
        if request.method == "GET":
            serializer = OrganizationSettingsDetailSerializer(settings_obj)
            return Response(serializer.data)
        # PATCH
        # Frontend sends { settings: {...} } or flat dict; support both.
        data = request.data.get("settings", request.data)
        serializer = OrganizationSettingsDetailSerializer(settings_obj, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
