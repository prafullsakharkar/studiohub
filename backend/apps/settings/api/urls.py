"""
URLs for Settings API.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.settings.api.viewsets.category import SettingCategoryViewSet
from apps.settings.api.viewsets.definition import SettingDefinitionViewSet
from apps.settings.api.viewsets.feature_flag import FeatureFlagViewSet
from apps.settings.api.viewsets.localization import LocalizationViewSet
from apps.settings.api.viewsets.organization import OrganizationSettingViewSet
from apps.settings.api.viewsets.system import SystemSettingViewSet
from apps.settings.api.viewsets.theme import ThemeViewSet

router = DefaultRouter()
router.register(r"categories", SettingCategoryViewSet, basename="setting-category")
router.register(r"definitions", SettingDefinitionViewSet, basename="setting-definition")
router.register(r"organization-settings", OrganizationSettingViewSet, basename="organization-setting")
router.register(r"system-settings", SystemSettingViewSet, basename="system-setting")
router.register(r"feature-flags", FeatureFlagViewSet, basename="feature-flag")
router.register(r"themes", ThemeViewSet, basename="theme")
router.register(r"localizations", LocalizationViewSet, basename="localization")


urlpatterns = [
    path("", include(router.urls)),
]
