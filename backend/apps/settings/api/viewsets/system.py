"""
System Setting ViewSet.
"""

from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.permissions.staff import IsStaff
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.settings.api.viewsets.base import SettingsBaseViewSet
from apps.settings.filters.system import SystemSettingFilter
from apps.settings.selectors.system import SystemSettingSelector
from apps.settings.serializers.system import SystemSettingSerializer
from apps.settings.services.system import SystemSettingService


class SystemSettingViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    SettingsBaseViewSet,
):
    """
    ViewSet for SystemSetting.

    System settings are platform-level configuration: only staff can
    create, modify, or delete them.
    """

    permission_classes = (
        IsAuthenticatedPermission,
        IsStaff,
    )

    serializer_class = SystemSettingSerializer
    service_class = SystemSettingService
    selector_class = SystemSettingSelector
    filter_class = SystemSettingFilter

    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset

    def perform_destroy(self, instance):
        """
        Route deletes through the service so locked settings are protected.
        """
        self.service_class.delete_setting(instance)

    @action(detail=True, methods=["post"])
    def lock(self, request, pk=None):
        """
        Lock a setting.
        """
        instance = self.get_object()
        self.service_class.lock_setting(instance, request.user)
        return Response({"status": "locked"})

    @action(detail=True, methods=["post"])
    def unlock(self, request, pk=None):
        """
        Unlock a setting.
        """
        instance = self.get_object()
        self.service_class.unlock_setting(instance)
        return Response({"status": "unlocked"})
