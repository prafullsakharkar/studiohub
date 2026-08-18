"""
Localization ViewSet.
"""

from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.settings.api.viewsets.base import SettingsBaseViewSet
from apps.settings.filters.localization import LocalizationFilter
from apps.settings.models.localization import Localization
from apps.settings.selectors.localization import LocalizationSelector
from apps.settings.serializers.localization import LocalizationSerializer
from apps.settings.services.localization import LocalizationService


class LocalizationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    SettingsBaseViewSet,
):
    """
    ViewSet for Localization.
    """

    serializer_class = LocalizationSerializer
    service_class = LocalizationService
    selector_class = LocalizationSelector
    filter_class = LocalizationFilter

    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        """
        Activate a localization.
        """
        instance = self.get_object()
        self.service_class.activate_localization(instance)
        return Response({"status": "activated"})

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        """
        Deactivate a localization.
        """
        instance = self.get_object()
        self.service_class.deactivate_localization(instance)
        return Response({"status": "deactivated"})
