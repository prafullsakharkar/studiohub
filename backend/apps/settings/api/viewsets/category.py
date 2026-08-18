"""
Setting Category ViewSet.
"""

from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.permissions.staff import IsStaff
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.settings.api.viewsets.base import SettingsBaseViewSet
from apps.settings.filters.category import SettingCategoryFilter
from apps.settings.models.category import SettingCategory
from apps.settings.selectors.category import SettingCategorySelector
from apps.settings.serializers.category import SettingCategorySerializer
from apps.settings.services.category import SettingCategoryService


class SettingCategoryViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    SettingsBaseViewSet,
):
    """
    ViewSet for SettingCategory.

    Categories are platform-level configuration: only staff can modify.
    """

    permission_classes = (
        IsAuthenticatedPermission,
        IsStaff,
    )

    serializer_class = SettingCategorySerializer
    service_class = SettingCategoryService
    selector_class = SettingCategorySelector
    filter_class = SettingCategoryFilter

    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        """
        Archive a category.
        """
        instance = self.get_object()
        self.service_class.archive_category(instance)
        return Response({"status": "archived"})

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """
        Restore a category.
        """
        instance = self.get_object()
        self.service_class.restore_category(instance)
        return Response({"status": "restored"})
