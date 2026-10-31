"""
Localization ViewSet.
"""

from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.settings.api.viewsets.base import SettingsBaseViewSet
from apps.settings.constants.permissions import SettingsPermissions
from apps.settings.filters.localization import LocalizationFilter
from apps.settings.selectors.localization import LocalizationSelector
from apps.settings.serializers.localization import LocalizationSerializer
from apps.settings.services.localization import LocalizationService


class LocalizationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    SettingsBaseViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    ViewSet for Localization.
    """

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    permission_map = {
        "list": (SettingsPermissions.VIEW,),
        "retrieve": (SettingsPermissions.VIEW,),
        "create": (SettingsPermissions.MANAGE,),
        "update": (SettingsPermissions.MANAGE,),
        "partial_update": (SettingsPermissions.MANAGE,),
        "destroy": (SettingsPermissions.MANAGE,),
        "default": (),
        "set_default": (SettingsPermissions.MANAGE,),
        "activate": (SettingsPermissions.MANAGE,),
        "deactivate": (SettingsPermissions.MANAGE,),
        "lock": (SettingsPermissions.MANAGE,),
        "unlock": (SettingsPermissions.MANAGE,),
    }

    # Which localization the app uses is not sensitive and every screen adapts to it.
    credential_open_actions = ("default",)

    serializer_class = LocalizationSerializer
    service_class = LocalizationService
    selector_class = LocalizationSelector
    filter_class = LocalizationFilter

    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).qs

    def perform_destroy(self, instance):
        """The default localization stays until another one is made the default."""
        self.service_class.delete_localization(instance)

    @action(detail=False, methods=["get"], url_path="default")
    def default(self, request):
        """The localization the app uses (404 when none was made). Open to anyone signed in, like the feature flags."""
        instance = self.get_queryset().filter(is_default=True).first()
        if instance is None:
            raise NotFound("No localization is the default yet.")
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=["post"], url_path="set-default")
    def set_default(self, request, pk=None):
        """Make this localization the one the app uses."""
        instance = self.get_object()
        self.service_class.set_default(instance)
        return Response({"status": "default"})

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
