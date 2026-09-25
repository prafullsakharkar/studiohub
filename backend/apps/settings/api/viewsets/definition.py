"""
Setting Definition ViewSet.
"""

from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.platform.constants.permissions import SettingsPermissions
from apps.settings.api.viewsets.base import SettingsBaseViewSet
from apps.settings.filters.definition import SettingDefinitionFilter
from apps.settings.selectors.definition import SettingDefinitionSelector
from apps.settings.serializers.definition import SettingDefinitionSerializer
from apps.settings.services.definition import SettingDefinitionService


class SettingDefinitionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    SettingsBaseViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    ViewSet for SettingDefinition.

    Definitions are platform-level configuration: only staff can modify.
    """

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    # ADR-0033 D4: platform settings are gated by explicit permission codes,
    # not by the ``is_staff`` attribute.
    permission_map = {
        "list": (SettingsPermissions.VIEW,),
        "retrieve": (SettingsPermissions.VIEW,),
        "create": (SettingsPermissions.MANAGE,),
        "update": (SettingsPermissions.MANAGE,),
        "partial_update": (SettingsPermissions.MANAGE,),
        "destroy": (SettingsPermissions.MANAGE,),
        "archive": (SettingsPermissions.MANAGE,),
        "restore": (SettingsPermissions.MANAGE,),
    }

    serializer_class = SettingDefinitionSerializer
    service_class = SettingDefinitionService
    selector_class = SettingDefinitionSelector
    filter_class = SettingDefinitionFilter

    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        """
        Archive a setting definition.
        """
        instance = self.get_object()
        self.service_class.archive_definition(instance)
        return Response({"status": "archived"})

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """
        Restore a setting definition.
        """
        instance = self.get_object()
        self.service_class.restore_definition(instance)
        return Response({"status": "restored"})
