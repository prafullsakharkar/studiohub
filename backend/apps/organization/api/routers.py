from rest_framework.routers import DefaultRouter

from apps.organization.api.viewsets import (
    BrandingViewSet,
    DepartmentViewSet,
    OfficeViewSet,
    OrganizationSettingsViewSet,
    OrganizationViewSet,
    TeamViewSet,
)

router = DefaultRouter()

router.register(
    "organizations",
    OrganizationViewSet,
    basename="organization",
)

router.register(
    "organization-settings",
    OrganizationSettingsViewSet,
    basename="organization_settings",
)

router.register(
    "departments",
    DepartmentViewSet,
    basename="department",
)

router.register(
    "teams",
    TeamViewSet,
    basename="team",
)

router.register(
    "offices",
    OfficeViewSet,
    basename="office",
)

router.register(
    "brandings",
    OfficeViewSet,
    basename="branding",
)

urlpatterns = router.urls
