"""
Feature Flag ViewSet.
"""

from django.utils.dateparse import parse_datetime
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.settings.api.viewsets.base import SettingsBaseViewSet
from apps.settings.constants.permissions import SettingsPermissions
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
    SettingsBaseViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    ViewSet for FeatureFlag.
    """

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    # Which features are on is not sensitive and tools adapt to it.
    credential_open_actions = ("list", "retrieve")

    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (SettingsPermissions.MANAGE,),
        "update": (SettingsPermissions.MANAGE,),
        "partial_update": (SettingsPermissions.MANAGE,),
        "destroy": (SettingsPermissions.MANAGE,),
        "enable": (SettingsPermissions.MANAGE,),
        "disable": (SettingsPermissions.MANAGE,),
        "schedule": (SettingsPermissions.MANAGE,),
    }

    serializer_class = FeatureFlagSerializer
    service_class = FeatureFlagService
    selector_class = FeatureFlagSelector
    filter_class = FeatureFlagFilter

    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).qs

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
        start_date = self._schedule_date(request.data, "start_date")
        end_date = self._schedule_date(request.data, "end_date")
        if end_date <= start_date:
            raise ValidationError({"end_date": ["End must be after the start."]})
        self.service_class.schedule_flag(instance, start_date, end_date)
        return Response({"status": "scheduled"})

    @staticmethod
    def _schedule_date(data, name):
        """A date-time with a zone: a missing, unparseable or zone-less value is a 400 naming the field."""
        raw = data.get(name)
        if raw in (None, ""):
            raise ValidationError({name: ["This field is required."]})
        try:
            value = parse_datetime(str(raw))
        except ValueError:
            value = None
        if value is None:
            raise ValidationError({name: ["Enter a valid date and time."]})
        if value.tzinfo is None:
            raise ValidationError(
                {name: ["Include a time zone, for example 2026-12-01T09:00:00Z."]}
            )
        return value
