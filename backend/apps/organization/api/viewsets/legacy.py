"""
Legacy flat aliases for frontend contract.

Provides /api/v1/{organizations,departments,teams,offices,people}/ endpoints
that reuse the same selectors/services as the canonical API but preserve
frontend-expected detail lookup behaviors:

- Organizations: id or code (case-insensitive).
- People: paginated (standard).
- Same permissions and scoping as canonical.

These viewsets are registered in `apps.organization.api.urls_legacy` and mounted
at the top-level /api/v1/ prefix (outside /organization/).

Contract pagination (frontend `organizationApi.ts` parity) is preserved here:

- Paginated: organizations, clients, vendors, people.
- Bare arrays: departments, teams, offices, positions, invitations,
  work-calendars, work-hours, calendars, holidays, roles, groups,
  permissions, api-keys, pats.

The same bare-array subclasses serve the nested
/api/organizations/<org>/<resource>/ tree (`urls_nested`): the shared
`OrganizationContextMixin` resolves the tenant from the URL kwarg dynamically,
so no separate Nested* subclasses are needed.
"""

from __future__ import annotations

from apps.organization.api.viewsets.api_key import APIKeyViewSet
from apps.organization.api.viewsets.calendar import CalendarViewSet
from apps.organization.api.viewsets.department import DepartmentViewSet
from apps.organization.api.viewsets.group import GroupViewSet
from apps.organization.api.viewsets.holiday import HolidayViewSet
from apps.organization.api.viewsets.invitation import InvitationViewSet
from apps.organization.api.viewsets.office import OfficeViewSet
from apps.organization.api.viewsets.organization import OrganizationViewSet
from apps.organization.api.viewsets.permission import PermissionViewSet
from apps.organization.api.viewsets.personal_access_token import (
    PersonalAccessTokenViewSet,
)
from apps.organization.api.viewsets.position import PositionViewSet
from apps.organization.api.viewsets.role import RoleViewSet
from apps.organization.api.viewsets.team import TeamViewSet
from apps.organization.api.viewsets.work_calendar import WorkCalendarViewSet
from apps.organization.api.viewsets.work_hours import WorkHoursViewSet


class LegacyOrganizationViewSet(OrganizationViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """
    Flat /api/v1/organizations/ alias.
    - Standard paginated list envelope (Phase 2).
    - Detail accepts id or code (case-insensitive).
    """

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        if not lookup:
            return super().get_object()
        queryset = self.filter_queryset(self.get_queryset())
        # Try by id (UUID) — gracefully handle non-UUID codes
        try:
            obj = queryset.filter(id=lookup).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        except (ValueError, TypeError, Exception):
            pass
        # Try by code (case-insensitive)
        try:
            obj = queryset.filter(code__iexact=lookup).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        except Exception:
            pass
        from django.http import Http404

        raise Http404


# ----------------------------------------------------------------------
# Bare-array compat viewsets (flat /api/v1/ + nested /api/organizations/<org>/).
#
# Canonical viewsets paginate with StandardPagination; the frontend contract
# expects bare arrays for these resources on both compat trees, so each alias
# only disables pagination. Detail lookup (id-or-code), status-word compat,
# permissions, and org scoping are inherited from the canonical viewsets.
# ----------------------------------------------------------------------


class LegacyDepartmentViewSet(DepartmentViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested departments — always bare array, id-or-code lookup."""

    pagination_class = None


class LegacyTeamViewSet(TeamViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested teams — always bare array, id-or-code lookup."""

    pagination_class = None


class LegacyOfficeViewSet(OfficeViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested offices — always bare array, id-or-code lookup."""

    pagination_class = None


class CompatPositionViewSet(PositionViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested positions — always bare array, id-or-code lookup."""

    pagination_class = None


class CompatInvitationViewSet(InvitationViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested invitations — always bare array, id-or-code lookup."""

    pagination_class = None


class CompatWorkCalendarViewSet(WorkCalendarViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested work-calendars — always bare array, id-or-code lookup."""

    pagination_class = None


class CompatWorkHoursViewSet(WorkHoursViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested work-hours — always bare array, id-or-code lookup."""

    pagination_class = None


class CompatCalendarViewSet(CalendarViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested calendars — always bare array, id-or-code lookup."""

    pagination_class = None


class CompatHolidayViewSet(HolidayViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested holidays — always bare array, id-or-code lookup."""

    pagination_class = None


class CompatRoleViewSet(RoleViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested roles — always bare array, id-or-code lookup."""

    pagination_class = None


class CompatGroupViewSet(GroupViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested groups — always bare array, id-or-code lookup."""

    pagination_class = None


class CompatPermissionViewSet(PermissionViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested permissions — always bare array, id-or-code lookup."""

    pagination_class = None


class CompatAPIKeyViewSet(APIKeyViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested api-keys — always bare array, id-or-code lookup."""

    pagination_class = None


class CompatPersonalAccessTokenViewSet(PersonalAccessTokenViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested pats — always bare array, id-or-code lookup."""

    pagination_class = None