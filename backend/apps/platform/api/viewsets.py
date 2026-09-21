"""
Platform viewsets for API endpoints.
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.organization.api.viewsets.scoped import OrganizationScopedViewSet
from apps.platform.constants.permissions import PlatformPermissions
from apps.platform.selectors import (
    ProductionReportSelector,
    StudioNotificationSelector,
)
from apps.platform.serializers import (
    ProductionReportSerializer,
    StudioNotificationSerializer,
)


class StudioNotificationViewSet(OrganizationScopedViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """ViewSet for StudioNotification."""

    selector_class = StudioNotificationSelector
    # Frontend contract: bare-array lists.
    pagination_class = None
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    serializer_map = {
        "list": StudioNotificationSerializer,
        "retrieve": StudioNotificationSerializer,
    }

    permission_map = {
        "list": (PlatformPermissions.NOTIFICATIONS_VIEW,),
        "retrieve": (PlatformPermissions.NOTIFICATIONS_VIEW,),
        "mark_read": (PlatformPermissions.NOTIFICATIONS_UPDATE,),
        "mark_all_read": (PlatformPermissions.NOTIFICATIONS_UPDATE,),
    }

    @action(detail=True, methods=["patch"], url_path="read")
    def mark_read(self, request, uuid=None):  # noqa: A002
        """Mark a single notification as read (org-scoped)."""
        notification = self.get_object()
        notification.read = True
        notification.save(update_fields=["read", "updated_at"])
        return Response(
            StudioNotificationSerializer(notification).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["patch"], url_path="read-all")
    def mark_all_read(self, request):
        """Mark all of the active organization's notifications as read."""
        queryset = self.filter_queryset(self.get_queryset())
        queryset.update(read=True)
        return Response({"ok": True}, status=status.HTTP_200_OK)


class ProductionReportViewSet(OrganizationScopedViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """ViewSet for ProductionReport."""

    selector_class = ProductionReportSelector
    # Frontend contract: bare-array lists.
    pagination_class = None
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    serializer_map = {
        "list": ProductionReportSerializer,
        "retrieve": ProductionReportSerializer,
    }

    permission_map = {
        "list": (PlatformPermissions.REPORTS_VIEW,),
        "retrieve": (PlatformPermissions.REPORTS_VIEW,),
    }
