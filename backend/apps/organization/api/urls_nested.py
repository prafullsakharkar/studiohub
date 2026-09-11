"""
Nested organization routes for the frontend contract.

Mounted at /api/organizations/<org>/<resource>/ (no /v1/, optional trailing
slash) to match `organizationApi.ts`, which prefers the nested form whenever
the active organization is known. Each viewset reuses the canonical
implementation with the contract pagination behavior (bare-array resources
use thin `legacy` aliases that only disable pagination):

- Paginated: clients, vendors, people.
- Bare arrays: departments, teams, offices, positions, invitations,
  work-calendars, work-hours, calendars, holidays, roles, groups,
  permissions, api-keys, pats.

``<org>`` accepts id, code, slug, or studiohub-react mock-dataset id
(``org-apex-01`` …; see ``OrganizationSelector.resolve_by_lookup``); the URL
organization always wins over the ``X-Organization-Id`` header.
"""

from rest_framework.routers import SimpleRouter

from apps.organization.api.viewsets.client import ClientViewSet
from apps.organization.api.viewsets.legacy import (
    CompatAPIKeyViewSet,
    CompatCalendarViewSet,
    CompatGroupViewSet,
    CompatHolidayViewSet,
    CompatInvitationViewSet,
    CompatPermissionViewSet,
    CompatPersonalAccessTokenViewSet,
    CompatPositionViewSet,
    CompatRoleViewSet,
    CompatWorkCalendarViewSet,
    CompatWorkHoursViewSet,
    LegacyDepartmentViewSet,
    LegacyOfficeViewSet,
    LegacyTeamViewSet,
)
from apps.organization.api.viewsets.person import PersonViewSet
from apps.organization.api.viewsets.vendor import VendorViewSet


class OptionalSlashRouter(SimpleRouter):
    """Router accepting endpoint URLs with or without a trailing slash."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.trailing_slash = "/?"


router = OptionalSlashRouter()

router.register(
    r"(?P<organization_id>[^/.]+)/departments",
    LegacyDepartmentViewSet,
    basename="nested-department",
)
router.register(
    r"(?P<organization_id>[^/.]+)/teams",
    LegacyTeamViewSet,
    basename="nested-team",
)
router.register(
    r"(?P<organization_id>[^/.]+)/offices",
    LegacyOfficeViewSet,
    basename="nested-office",
)
router.register(
    r"(?P<organization_id>[^/.]+)/people",
    PersonViewSet,
    basename="nested-person",
)
router.register(
    r"(?P<organization_id>[^/.]+)/clients",
    ClientViewSet,
    basename="nested-client",
)
router.register(
    r"(?P<organization_id>[^/.]+)/vendors",
    VendorViewSet,
    basename="nested-vendor",
)
router.register(
    r"(?P<organization_id>[^/.]+)/positions",
    CompatPositionViewSet,
    basename="nested-position",
)
router.register(
    r"(?P<organization_id>[^/.]+)/invitations",
    CompatInvitationViewSet,
    basename="nested-invitation",
)
router.register(
    r"(?P<organization_id>[^/.]+)/work-calendars",
    CompatWorkCalendarViewSet,
    basename="nested-work-calendar",
)
router.register(
    r"(?P<organization_id>[^/.]+)/work-hours",
    CompatWorkHoursViewSet,
    basename="nested-work-hours",
)
router.register(
    r"(?P<organization_id>[^/.]+)/calendars",
    CompatCalendarViewSet,
    basename="nested-calendar",
)
router.register(
    r"(?P<organization_id>[^/.]+)/holidays",
    CompatHolidayViewSet,
    basename="nested-holiday",
)
router.register(
    r"(?P<organization_id>[^/.]+)/roles",
    CompatRoleViewSet,
    basename="nested-role",
)
router.register(
    r"(?P<organization_id>[^/.]+)/groups",
    CompatGroupViewSet,
    basename="nested-group",
)
router.register(
    r"(?P<organization_id>[^/.]+)/permissions",
    CompatPermissionViewSet,
    basename="nested-permission",
)
router.register(
    r"(?P<organization_id>[^/.]+)/api-keys",
    CompatAPIKeyViewSet,
    basename="nested-api-key",
)
router.register(
    r"(?P<organization_id>[^/.]+)/pats",
    CompatPersonalAccessTokenViewSet,
    basename="nested-pat",
)

app_name = "organization-nested"

urlpatterns = router.urls
