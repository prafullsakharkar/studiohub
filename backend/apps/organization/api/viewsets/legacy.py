"""
Legacy flat aliases for frontend contract.

Provides /api/v1/{organizations,departments,teams,offices,people}/ endpoints
that reuse the same selectors/services as the namespaced v2 API but preserve
frontend-expected behaviors:

- Organizations: bare array unless ?page or ?page_size is present, then paginated.
- Departments/Teams/Offices: always bare array (pagination_class = None).
- People: paginated (standard).
- Detail lookups: id-or-code (code case-insensitive, uppercased in frontend).
- Same permissions and scoping as v2.

These viewsets are registered in `apps.organization.api.urls_legacy` and mounted
at the top-level /api/v1/ prefix (outside /organization/).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, ClassVar

from django.http import Http404
from rest_framework.response import Response

from apps.organization.api.viewsets.api_key import APIKeyViewSet
from apps.organization.api.viewsets.calendar import CalendarViewSet
from apps.organization.api.viewsets.client import ClientViewSet
from apps.organization.api.viewsets.department import DepartmentViewSet
from apps.organization.api.viewsets.group import GroupViewSet
from apps.organization.api.viewsets.holiday import HolidayViewSet
from apps.organization.api.viewsets.invitation import InvitationViewSet
from apps.organization.api.viewsets.office import OfficeViewSet
from apps.organization.api.viewsets.organization import OrganizationViewSet
from apps.organization.api.viewsets.permission import PermissionViewSet
from apps.organization.api.viewsets.person import PersonViewSet
from apps.organization.api.viewsets.personal_access_token import (
    PersonalAccessTokenViewSet,
)
from apps.organization.api.viewsets.position import PositionViewSet
from apps.organization.api.viewsets.role import RoleViewSet
from apps.organization.api.viewsets.team import TeamViewSet
from apps.organization.api.viewsets.vendor import VendorViewSet
from apps.organization.api.viewsets.work_calendar import WorkCalendarViewSet
from apps.organization.api.viewsets.work_hours import WorkHoursViewSet


class LegacyOrganizationViewSet(OrganizationViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """
    Flat /api/v1/organizations/ alias.
    - Conditional pagination: bare array if no page params, else paginated.
    - Detail accepts id or code (case-insensitive).
    """

    def list(self, request, *args, **kwargs):
        # If pagination params are present, use standard paginated flow
        if "page" in request.query_params or "page_size" in request.query_params or "limit" in request.query_params:
            return super().list(request, *args, **kwargs)
        # Bare array
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

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
        raise Http404


class LegacyDepartmentViewSet(DepartmentViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/departments/ — always bare array, id-or-code lookup."""

    pagination_class = None

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        queryset = self.filter_queryset(self.get_queryset())
        try:
            obj = queryset.filter(id=lookup).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        except (ValueError, TypeError, Exception):
            pass
        try:
            obj = queryset.filter(code__iexact=lookup).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        except Exception:
            pass
        raise Http404


class LegacyTeamViewSet(TeamViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/teams/ — always bare array, id-or-code lookup."""

    pagination_class = None

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        queryset = self.filter_queryset(self.get_queryset())
        try:
            obj = queryset.filter(id=lookup).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        except (ValueError, TypeError, Exception):
            pass
        try:
            obj = queryset.filter(code__iexact=lookup).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        except Exception:
            pass
        raise Http404


class LegacyOfficeViewSet(OfficeViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/offices/ — always bare array, id-or-code lookup."""

    pagination_class = None

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        queryset = self.filter_queryset(self.get_queryset())
        try:
            obj = queryset.filter(id=lookup).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        except (ValueError, TypeError, Exception):
            pass
        try:
            obj = queryset.filter(code__iexact=lookup).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        except Exception:
            pass
        raise Http404


class LegacyPersonViewSet(PersonViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/people/ — paginated, id lookup only (Person has no code)."""

    # Use standard pagination (inherited). Keep get_queryset bypass.
    pass


# ----------------------------------------------------------------------
# Shared compat mixins
# ----------------------------------------------------------------------


class IdOrCodeDetailMixin:
    """Detail lookup by UUID id or ``code`` (case-insensitive).

    Degrades gracefully to id-only lookup for models without a ``code``
    field. Used by the flat/nested frontend-contract aliases.
    """

    # Mixin contract: provided by the viewset this mixin is combined with.
    # Annotations only, no runtime effect.
    kwargs: ClassVar[Any]
    lookup_url_kwarg: ClassVar[str | None]
    lookup_field: ClassVar[str]
    request: ClassVar[Any]
    selector_class: ClassVar[Any]
    service_class: ClassVar[Any]
    filter_queryset: ClassVar[Callable[..., Any]]
    get_queryset: ClassVar[Callable[..., Any]]
    check_object_permissions: ClassVar[Callable[..., None]]

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        queryset = self.filter_queryset(self.get_queryset())
        try:
            obj = queryset.filter(id=lookup).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        except (ValueError, TypeError, Exception):
            pass
        model = getattr(getattr(self, "selector_class", None), "model", None) or getattr(
            getattr(self, "service_class", None), "model", None
        )
        if model is not None:
            try:
                model._meta.get_field("code")
            except Exception:  # noqa: BLE001
                model = None
        if model is not None:
            try:
                obj = queryset.filter(code__iexact=lookup).first()
                if obj:
                    self.check_object_permissions(self.request, obj)
                    return obj
            except Exception:  # noqa: BLE001
                pass
        raise Http404


class NestedOrganizationMixin:
    """Resolve the organization from the ``organization_id`` URL kwarg.

    Nested frontend routes (``/api/organizations/<org>/...``) carry the
    tenant in the path instead of (or in addition to) the
    ``X-Organization-Id`` header. The URL organization wins: unknown orgs
    404, and the resolved org + membership replace the header-derived
    context so selectors, permissions, and creates stay tenant-correct.

    ``<org>`` accepts UUID id, ``code``, ``slug`` (case-insensitive), and
    studiohub-react mock-dataset ids (``org-apex-01`` …) via
    ``OrganizationSelector.resolve_by_lookup``.
    """

    organization_lookup_url_kwarg = "organization_id"
    # Mixin contract: provided by the viewset this mixin is combined with.
    # Annotations only, no runtime effect.
    kwargs: ClassVar[Any]

    def perform_authentication(self, request):
        # reportAttributeAccessIssue: super() is the combined DRF viewset.
        response = super().perform_authentication(request)  # pyright: ignore[reportAttributeAccessIssue]
        from apps.organization.models import OrganizationMembership
        from apps.organization.selectors.organization import OrganizationSelector

        lookup = self.kwargs.get(self.organization_lookup_url_kwarg)
        org = OrganizationSelector.resolve_by_lookup(lookup)
        if org is None:
            raise Http404("Organization not found.")
        request.organization = org
        membership = None
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            membership = (
                OrganizationMembership.objects.filter(
                    user=user, organization=org, is_deleted=False
                )
                .select_related("role")
                .first()
            )
        request.membership = membership
        request._org_context_resolved = True
        return response


class FrontendStatusCompatMixin:
    """Map frontend status words to backend values (compat aliases only).

    - ``frontend_status_map``: same-field value mapping applied to incoming
      ``status`` (e.g. invitations ``revoked`` -> ``cancelled``).
    - ``frontend_status_target`` + ``frontend_status_target_map``: map
      incoming ``status`` onto a different field (e.g. api keys
      ``status`` -> ``is_active`` boolean).
    - ``frontend_status_output``: ``{source: {backend_value: frontend_word}}``
      applied to list/retrieve payloads. ``source`` is either a payload key
      (value mapping) or ``"is_active"`` (boolean mapping).
    """

    frontend_status_map: ClassVar[dict[str, str]] = {}
    frontend_status_target: ClassVar[str | None] = None
    frontend_status_target_map: ClassVar[dict[str, Any]] = {}
    frontend_status_output: ClassVar[dict[str, dict[Any, str]]] = {}
    # Mixin contract: provided by the viewset this mixin is combined with.
    # Annotations only, no runtime effect.
    request: ClassVar[Any]

    def _rewrite_status_input(self):
        data = getattr(self.request, "data", None)
        if not isinstance(data, dict):
            return
        raw = data.get("status")
        if not isinstance(raw, str):
            return
        key = raw.strip().lower()
        if self.frontend_status_target and key in self.frontend_status_target_map:
            data[self.frontend_status_target] = self.frontend_status_target_map[key]
            data.pop("status", None)
        elif key in self.frontend_status_map:
            data["status"] = self.frontend_status_map[key]

    def update(self, request, *args, **kwargs):
        self._rewrite_status_input()
        # reportAttributeAccessIssue: super() is the combined DRF viewset.
        response = super().update(request, *args, **kwargs)  # pyright: ignore[reportAttributeAccessIssue]
        response.data = self._inject_status_output(response.data)
        return response

    def partial_update(self, request, *args, **kwargs):
        self._rewrite_status_input()
        # reportAttributeAccessIssue: super() is the combined DRF viewset.
        response = super().partial_update(request, *args, **kwargs)  # pyright: ignore[reportAttributeAccessIssue]
        response.data = self._inject_status_output(response.data)
        return response

    def _inject_status_output(self, payload):
        if isinstance(payload, dict) and isinstance(payload.get("results"), list):
            for item in payload["results"]:
                self._inject_item_status(item)
            return payload
        if isinstance(payload, list):
            for item in payload:
                self._inject_item_status(item)
            return payload
        if isinstance(payload, dict):
            self._inject_item_status(payload)
        return payload

    def _inject_item_status(self, item):
        if not isinstance(item, dict):
            return
        for source, mapping in self.frontend_status_output.items():
            if source == "is_active":
                item["status"] = mapping.get(bool(item.get("is_active")), item.get("status"))
            elif source in item:
                item[source] = mapping.get(item[source], item[source])

    def list(self, request, *args, **kwargs):
        # reportAttributeAccessIssue: super() is the combined DRF viewset.
        response = super().list(request, *args, **kwargs)  # pyright: ignore[reportAttributeAccessIssue]
        response.data = self._inject_status_output(response.data)
        return response

    def retrieve(self, request, *args, **kwargs):
        # reportAttributeAccessIssue: super() is the combined DRF viewset.
        response = super().retrieve(request, *args, **kwargs)  # pyright: ignore[reportAttributeAccessIssue]
        response.data = self._inject_status_output(response.data)
        return response


# ----------------------------------------------------------------------
# Flat bare-array compat viewsets (/api/v1/<resource>/)
# ----------------------------------------------------------------------


class CompatPositionViewSet(IdOrCodeDetailMixin, PositionViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/positions/ — always bare array, id-or-code lookup."""

    pagination_class = None


class CompatInvitationViewSet(
    FrontendStatusCompatMixin, IdOrCodeDetailMixin, InvitationViewSet
):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/invitations/ — bare array + frontend status words."""

    pagination_class = None
    frontend_status_map = {
        "revoked": "cancelled",
        "cancelled": "cancelled",
        "pending": "pending",
        "accepted": "accepted",
        "declined": "declined",
        "expired": "expired",
    }
    frontend_status_output = {
        "status": {
            "pending": "Pending",
            "accepted": "Accepted",
            "expired": "Expired",
            "cancelled": "Revoked",
            "declined": "Revoked",
        }
    }


class CompatWorkCalendarViewSet(IdOrCodeDetailMixin, WorkCalendarViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/work-calendars/ — bare array, id-or-code lookup."""

    pagination_class = None


class CompatWorkHoursViewSet(IdOrCodeDetailMixin, WorkHoursViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/work-hours/ — bare array, id-or-code lookup."""

    pagination_class = None


class CompatCalendarViewSet(IdOrCodeDetailMixin, CalendarViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/calendars/ — bare array, id-or-code lookup."""

    pagination_class = None


class CompatHolidayViewSet(IdOrCodeDetailMixin, HolidayViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/holidays/ — bare array, id-or-code lookup."""

    pagination_class = None


class CompatRoleViewSet(IdOrCodeDetailMixin, RoleViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/roles/ — bare array, id-or-code lookup."""

    pagination_class = None


class CompatGroupViewSet(IdOrCodeDetailMixin, GroupViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/groups/ — bare array, id-or-code lookup."""

    pagination_class = None


class CompatPermissionViewSet(IdOrCodeDetailMixin, PermissionViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/permissions/ — bare array, id-or-code lookup."""

    pagination_class = None


class CompatAPIKeyViewSet(
    FrontendStatusCompatMixin, IdOrCodeDetailMixin, APIKeyViewSet
):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/api-keys/ — bare array + status <-> is_active mapping."""

    pagination_class = None
    frontend_status_target = "is_active"
    frontend_status_target_map = {"revoked": False, "expired": False, "active": True}
    frontend_status_output = {"is_active": {True: "Active", False: "Revoked"}}


class CompatPersonalAccessTokenViewSet(
    FrontendStatusCompatMixin, IdOrCodeDetailMixin, PersonalAccessTokenViewSet
):  # pyright: ignore[reportMissingTypeArgument]
    """Flat /api/v1/pats/ — bare array + status <-> is_active mapping."""

    pagination_class = None
    frontend_status_target = "is_active"
    frontend_status_target_map = {"revoked": False, "expired": False, "active": True}
    frontend_status_output = {"is_active": {True: "Active", False: "Revoked"}}


# ----------------------------------------------------------------------
# Nested viewsets (/api/organizations/<org>/<resource>/)
# ----------------------------------------------------------------------


class NestedDepartmentViewSet(NestedOrganizationMixin, LegacyDepartmentViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested departments — bare array."""


class NestedTeamViewSet(NestedOrganizationMixin, LegacyTeamViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested teams — bare array."""


class NestedOfficeViewSet(NestedOrganizationMixin, LegacyOfficeViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested offices — bare array."""


class NestedPersonViewSet(NestedOrganizationMixin, LegacyPersonViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested people — paginated."""


class NestedClientViewSet(NestedOrganizationMixin, ClientViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested clients — paginated."""


class NestedVendorViewSet(NestedOrganizationMixin, VendorViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested vendors — paginated."""


class NestedPositionViewSet(NestedOrganizationMixin, CompatPositionViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested positions — bare array."""


class NestedInvitationViewSet(NestedOrganizationMixin, CompatInvitationViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested invitations — bare array + status mapping."""


class NestedWorkCalendarViewSet(NestedOrganizationMixin, CompatWorkCalendarViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested work calendars — bare array."""


class NestedWorkHoursViewSet(NestedOrganizationMixin, CompatWorkHoursViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested work hours — bare array."""


class NestedCalendarViewSet(NestedOrganizationMixin, CompatCalendarViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested calendars — bare array."""


class NestedHolidayViewSet(NestedOrganizationMixin, CompatHolidayViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested holidays — bare array."""


class NestedRoleViewSet(NestedOrganizationMixin, CompatRoleViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested roles — bare array."""


class NestedGroupViewSet(NestedOrganizationMixin, CompatGroupViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested groups — bare array."""


class NestedPermissionViewSet(NestedOrganizationMixin, CompatPermissionViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested permissions — bare array (global catalog)."""


class NestedAPIKeyViewSet(NestedOrganizationMixin, CompatAPIKeyViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested api-keys — bare array + status mapping."""


class NestedPersonalAccessTokenViewSet(NestedOrganizationMixin, CompatPersonalAccessTokenViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Nested pats — bare array + status mapping."""
