"""
Feature Flag ViewSet.
"""

from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.settings.api.viewsets.base import SettingsBaseViewSet
from apps.settings.filters.feature_flag import FeatureFlagFilter
from apps.settings.selectors.feature_flag import FeatureFlagSelector
from apps.settings.serializers.feature_flag import FeatureFlagSerializer
from apps.settings.services.feature_flag import FeatureFlagService


class FeatureFlagViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    SettingsBaseViewSet,
):
    """
    ViewSet for FeatureFlag.
    """

    serializer_class = FeatureFlagSerializer
    service_class = FeatureFlagService
    selector_class = FeatureFlagSelector
    filter_class = FeatureFlagFilter

    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset

    @action(detail=True, methods=["post"])
    def enable(self, request, pk=None):
        """
        Enable a feature flag.
        """
        instance = self.get_object()
        self.service_class.enable_flag(instance)
        return Response({"status": "enabled"})

    @action(detail=True, methods=["post"])
    def disable(self, request, pk=None):
        """
        Disable a feature flag.
        """
        instance = self.get_object()
        self.service_class.disable_flag(instance)
        return Response({"status": "disabled"})

    @action(detail=True, methods=["post"])
    def schedule(self, request, pk=None):
        """
        Schedule a feature flag.
        """
        instance = self.get_object()
        start_date = request.data.get("start_date")
        end_date = request.data.get("end_date")
        self.service_class.schedule_flag(instance, start_date, end_date)
        return Response({"status": "scheduled"})
