"""
Organization Setting ViewSet.
"""

from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.settings.api.viewsets.base import SettingsBaseViewSet
from apps.settings.filters.organization import OrganizationSettingFilter
from apps.settings.models.organization import OrganizationSetting
from apps.settings.selectors.organization import OrganizationSettingSelector
from apps.settings.serializers.organization import OrganizationSettingSerializer
from apps.settings.services.organization import OrganizationSettingService


class OrganizationSettingViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    SettingsBaseViewSet,
):
    """
    ViewSet for OrganizationSetting.
    """

    serializer_class = OrganizationSettingSerializer
    service_class = OrganizationSettingService
    selector_class = OrganizationSettingSelector
    filter_class = OrganizationSettingFilter

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
