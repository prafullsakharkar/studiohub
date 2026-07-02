from rest_framework.routers import DefaultRouter

from apps.organization.api.viewsets import (
    DepartmentViewSet,
    OfficeViewSet,
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

urlpatterns = router.urls
