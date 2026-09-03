"""
Theme ViewSet.
"""

from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.settings.api.viewsets.base import SettingsBaseViewSet
from apps.settings.filters.theme import ThemeFilter
from apps.settings.selectors.theme import ThemeSelector
from apps.settings.serializers.theme import ThemeSerializer
from apps.settings.services.theme import ThemeService


class ThemeViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    SettingsBaseViewSet,
):
    """
    ViewSet for Theme.
    """

    serializer_class = ThemeSerializer
    service_class = ThemeService
    selector_class = ThemeSelector
    filter_class = ThemeFilter

    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        """
        Activate a theme.
        """
        instance = self.get_object()
        self.service_class.activate_theme(instance)
        return Response({"status": "activated"})

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        """
        Deactivate a theme.
        """
        instance = self.get_object()
        self.service_class.deactivate_theme(instance)
        return Response({"status": "deactivated"})
