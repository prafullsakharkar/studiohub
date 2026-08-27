from rest_framework.routers import DefaultRouter

from apps.organization.api.viewsets import (
    APIKeyViewSet,
    BrandingViewSet,
    CalendarViewSet,
    DepartmentViewSet,
    GroupMemberViewSet,
    GroupRoleViewSet,
    GroupViewSet,
    HolidayViewSet,
    InvitationViewSet,
    OfficeViewSet,
    OrganizationMembershipViewSet,
    OrganizationSettingsViewSet,
    OrganizationViewSet,
    PermissionViewSet,
    PersonViewSet,
    PersonalAccessTokenViewSet,
    PositionViewSet,
    RolePermissionViewSet,
    RoleViewSet,
    TeamViewSet,
    UserRoleViewSet,
    WorkCalendarViewSet,
    WorkHoursViewSet,
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
    basename="calendar",
)

router.register(
    "holidays",
    HolidayViewSet,
    basename="holiday",
)

router.register(
    "work-calendars",
    WorkCalendarViewSet,
    basename="work_calendar",
)

router.register(
    "work-hours",
    WorkHoursViewSet,
    basename="work_hours",
)

router.register(
    "positions",
    PositionViewSet,
    basename="position",
)

router.register(
    "api-keys",
    APIKeyViewSet,
    basename="api_key",
)

router.register(
    "personal-access-tokens",
    PersonalAccessTokenViewSet,
    basename="personal_access_token",
)

router.register(
    "invitations",
    InvitationViewSet,
    basename="invitation",
)

router.register(
    "memberships",
    OrganizationMembershipViewSet,
    basename="organization_membership",
)

router.register(
    "groups",
    GroupViewSet,
    basename="group",
)

router.register(
    "roles",
    RoleViewSet,
    basename="role",
)

router.register(
    "permissions",
    PermissionViewSet,
    basename="permission",
)

router.register(
    "user-roles",
    UserRoleViewSet,
    basename="user_role",
)

router.register(
    "group-members",
    GroupMemberViewSet,
    basename="group_member",
)

router.register(
    "group-roles",
    GroupRoleViewSet,
    basename="group_role",
)

router.register(
    "role-permissions",
    RolePermissionViewSet,
    basename="role_permission",
)

router.register(
    "persons",
    PersonViewSet,
    basename="person",
)

urlpatterns = router.urls
