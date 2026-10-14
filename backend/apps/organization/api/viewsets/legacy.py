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
- Bare arrays by default (opt-in pagination via ?page= / ?page_size=):
  work-calendars, work-hours, calendars, holidays.
- Always bare arrays: roles, groups, permissions, api-keys, pats.

The same bare-array subclasses serve the nested
/api/organizations/<org>/<resource>/ tree (`urls_nested`): the shared
`OrganizationContextMixin` resolves the tenant from the URL kwarg dynamically,
so no separate Nested* subclasses are needed.
"""

from __future__ import annotations

from apps.core.api.pagination import StandardPagination
from apps.organization.api.viewsets.api_key import APIKeyViewSet
from apps.organization.api.viewsets.calendar import CalendarViewSet
from apps.organization.api.viewsets.calendar_event import CalendarEventViewSet
from apps.organization.api.viewsets.department import DepartmentViewSet
from apps.organization.api.viewsets.group import GroupViewSet
from apps.organization.api.viewsets.holiday import HolidayViewSet
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
# expects bare arrays for these resources on both compat trees when no
# paging params are present, so the entity-table aliases below use
# OptionalPagination (envelope only on ?page= / ?page_size=). Detail lookup
# (id-or-code), status-word compat, permissions, and org scoping are
# inherited from the canonical viewsets.
# ----------------------------------------------------------------------


class OptionalPagination(StandardPagination):
    """Paginate only when the client asks (?page=, ?page_size= or ?limit= present).

    Preserves the bare-array contract for existing callers (OrgEntitySelector
    dropdowns, tab lists) while enabling server-driven tables.
    """

    def paginate_queryset(self, queryset, request, view=None):
        if (
            'page' not in request.query_params
            and 'page_size' not in request.query_params
            and 'limit' not in request.query_params
        ):
            return None
        return super().paginate_queryset(queryset, request, view=view)


class LegacyDepartmentViewSet(DepartmentViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested departments — bare array by default, id-or-code lookup."""

    pagination_class = OptionalPagination


class LegacyTeamViewSet(TeamViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested teams — bare array by default, id-or-code lookup."""

    pagination_class = OptionalPagination


class LegacyOfficeViewSet(OfficeViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested offices — bare array by default, id-or-code lookup."""

    pagination_class = OptionalPagination


class CompatPositionViewSet(PositionViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested positions — bare array by default, id-or-code lookup."""

    pagination_class = OptionalPagination


class CompatWorkCalendarViewSet(WorkCalendarViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested work-calendars — bare array by default, id-or-code lookup."""

    pagination_class = OptionalPagination


class CompatWorkHoursViewSet(WorkHoursViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested work-hours — bare array by default, id-or-code lookup."""

    pagination_class = OptionalPagination


class CompatCalendarViewSet(CalendarViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested calendars — bare array by default, id-or-code lookup."""

    pagination_class = OptionalPagination


class CompatCalendarEventViewSet(CalendarEventViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested calendar events — bare array by default, id-or-code lookup."""

    pagination_class = OptionalPagination


class CompatHolidayViewSet(HolidayViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat/nested holidays — bare array by default, id-or-code lookup."""

    pagination_class = OptionalPagination


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