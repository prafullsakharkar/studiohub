"""
Nested organization routes for the frontend contract.

Mounted at /api/organizations/<org>/<resource>/ (no /v1/, optional trailing
slash) to match `organizationApi.ts`, which prefers the nested form whenever
the active organization is known. Each viewset reuses the namespaced
 implementation with the contract pagination behavior:

- Paginated: clients, vendors, people.
- Bare arrays: departments, teams, offices, positions, invitations,
  work-calendars, work-hours, calendars, holidays, roles, groups,
  permissions, api-keys, pats.

``<org>`` accepts id, code, or slug (see NestedOrganizationMixin); the URL
organization always wins over the ``X-Organization-Id`` header.
"""

from rest_framework.routers import SimpleRouter

from apps.organization.api.viewsets.legacy import (
    NestedAPIKeyViewSet,
    NestedCalendarViewSet,
    NestedClientViewSet,
    NestedDepartmentViewSet,
    NestedGroupViewSet,
    NestedHolidayViewSet,
    NestedInvitationViewSet,
    NestedOfficeViewSet,
    NestedPermissionViewSet,
    NestedPersonalAccessTokenViewSet,
    NestedPersonViewSet,
    NestedPositionViewSet,
    NestedRoleViewSet,
    NestedTeamViewSet,
    NestedVendorViewSet,
    NestedWorkCalendarViewSet,
    NestedWorkHoursViewSet,
)


class OptionalSlashRouter(SimpleRouter):
    """Router accepting endpoint URLs with or without a trailing slash."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.trailing_slash = "/?"


router = OptionalSlashRouter()

router.register(
    r"(?P<organization_id>[^/.]+)/departments",
    NestedDepartmentViewSet,
    basename="nested-department",
)
router.register(
    r"(?P<organization_id>[^/.]+)/teams",
    NestedTeamViewSet,
    basename="nested-team",
)
router.register(
    r"(?P<organization_id>[^/.]+)/offices",
    NestedOfficeViewSet,
    basename="nested-office",
)
router.register(
    r"(?P<organization_id>[^/.]+)/people",
    NestedPersonViewSet,
    basename="nested-person",
)
router.register(
    r"(?P<organization_id>[^/.]+)/clients",
    NestedClientViewSet,
    basename="nested-client",
)
router.register(
    r"(?P<organization_id>[^/.]+)/vendors",
    NestedVendorViewSet,
    basename="nested-vendor",
)
router.register(
    r"(?P<organization_id>[^/.]+)/positions",
    NestedPositionViewSet,
    basename="nested-position",
)
router.register(
    r"(?P<organization_id>[^/.]+)/invitations",
    NestedInvitationViewSet,
    basename="nested-invitation",
)
router.register(
    r"(?P<organization_id>[^/.]+)/work-calendars",
    NestedWorkCalendarViewSet,
    basename="nested-work-calendar",
)
router.register(
    r"(?P<organization_id>[^/.]+)/work-hours",
    NestedWorkHoursViewSet,
    basename="nested-work-hours",
)
router.register(
    r"(?P<organization_id>[^/.]+)/calendars",
    NestedCalendarViewSet,
    basename="nested-calendar",
)
router.register(
    r"(?P<organization_id>[^/.]+)/holidays",
    NestedHolidayViewSet,
    basename="nested-holiday",
)
router.register(
    r"(?P<organization_id>[^/.]+)/roles",
    NestedRoleViewSet,
    basename="nested-role",
)
router.register(
    r"(?P<organization_id>[^/.]+)/groups",
    NestedGroupViewSet,
    basename="nested-group",
)
router.register(
    r"(?P<organization_id>[^/.]+)/permissions",
    NestedPermissionViewSet,
    basename="nested-permission",
)
router.register(
    r"(?P<organization_id>[^/.]+)/api-keys",
    NestedAPIKeyViewSet,
    basename="nested-api-key",
)
router.register(
    r"(?P<organization_id>[^/.]+)/pats",
    NestedPersonalAccessTokenViewSet,
    basename="nested-pat",
)

app_name = "organization-nested"

urlpatterns = router.urls
