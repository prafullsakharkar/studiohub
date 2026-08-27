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

from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework.response import Response

from apps.organization.api.viewsets.department import DepartmentViewSet
from apps.organization.api.viewsets.office import OfficeViewSet
from apps.organization.api.viewsets.organization import OrganizationViewSet
from apps.organization.api.viewsets.person import PersonViewSet
from apps.organization.api.viewsets.team import TeamViewSet


class LegacyOrganizationViewSet(OrganizationViewSet):
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


class LegacyDepartmentViewSet(DepartmentViewSet):
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


class LegacyTeamViewSet(TeamViewSet):
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


class LegacyOfficeViewSet(OfficeViewSet):
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


class LegacyPersonViewSet(PersonViewSet):
    """Flat /api/v1/people/ — paginated, id lookup only (Person has no code)."""

    # Use standard pagination (inherited). Keep get_queryset bypass.
    pass
