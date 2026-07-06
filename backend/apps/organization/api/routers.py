from rest_framework.routers import DefaultRouter

from apps.organization.api.viewsets import (
    BrandingViewSet,
    CalendarViewSet,
    DepartmentViewSet,
    OfficeViewSet,
    OrganizationSettingsViewSet,
    OrganizationViewSet,
    PositionViewSet,
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
    BrandingViewSet,
    basename="branding",
)

router.register(
    "calendars",
    CalendarViewSet,
    basename="branding",
)

router.register(
    "positions",
    PositionViewSet,
    basename="position",
)
urlpatterns = router.urls
