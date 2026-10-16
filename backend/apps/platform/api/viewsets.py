"""
Platform viewsets for API endpoints.
"""
from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.viewsets.platform import PlatformScopedViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.platform.constants.permissions import PlatformPermissions
from apps.platform.selectors import (
    ProductionReportSelector,
    StudioNotificationSelector,
)
from apps.platform.serializers import (
    ProductionReportSerializer,
    StudioNotificationSerializer,
)


class PlatformReadViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    PlatformScopedViewSet,
):
    """Platform-global reads (org-free).

    ``serializer_map`` (action -> serializer) mirrors the declarative
    contract of the former org-scoped base so viewsets keep resolving
    serializers per action without a global ``serializer_class``.
    """

    # Same URL contract as the former org-scoped base: ``uuid`` kwarg
    # resolving against the ``id`` primary key.
    lookup_field = "id"
    lookup_url_kwarg = "uuid"

    serializer_map = {}

    def get_serializer_class(self):
        action = getattr(self, "action", None)
        serializer = self.serializer_map.get(action)
        if serializer:
            return serializer
        if self.serializer_map and (action is None or action not in self.serializer_map):
            # Schema generation (drf-spectacular) introspects operations
            # before dispatch (no action set) and for unmapped actions;
            # fall back to the primary mapped serializer so OpenAPI can
            # resolve. Runtime behavior for mapped actions is unchanged.
            preferred = self.serializer_map.get("list")
            return preferred or next(iter(self.serializer_map.values()))
        return super().get_serializer_class()


class StudioNotificationViewSet(PlatformReadViewSet):  # pyright: ignore[reportMissingTypeArgument]
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
        """Mark a single notification as read."""
        notification = self.get_object()
        notification.read = True
        notification.save(update_fields=["read", "updated_at"])
        return Response(
            StudioNotificationSerializer(notification).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["patch"], url_path="read-all")
    def mark_all_read(self, request):
        """Mark all notifications as read."""
        queryset = self.filter_queryset(self.get_queryset())
        queryset.update(read=True)
        return Response({"ok": True}, status=status.HTTP_200_OK)


class ProductionReportViewSet(PlatformReadViewSet):  # pyright: ignore[reportMissingTypeArgument]
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
