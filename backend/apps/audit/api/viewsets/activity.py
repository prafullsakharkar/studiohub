"""
Activity ViewSet.
"""

from __future__ import annotations

from typing import Any, cast

from django.http import Http404
from rest_framework import mixins

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.filters.activity import ActivityFilter
from apps.audit.selectors.activity import ActivitySelector
from apps.audit.serializers.activity import ActivityFrontendSerializer, ActivitySerializer
from apps.audit.services.activity import ActivityService
from apps.core.api.pagination import StandardPagination


class ActivityViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    AuditEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    ViewSet for Activity.
    """
    
    serializer_class = ActivitySerializer
    service_class = ActivityService
    selector_class = ActivitySelector
    filter_class = ActivityFilter
    
    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset


class ActivityCompatViewSet(ActivityViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Frontend-contract activity feed (Phase 3 gap P1-3).

    Serves ``GET /api/v1/activity/`` (flat) and
    ``GET /api/organizations/<org>/activity/`` (nested) as a paginated
    ``{count, next, previous, results}`` feed in the frontend shape
    (``useOrganizationActivity`` reads ``results[]``).

    Non-staff callers only ever see organizations they belong to (fail
    closed); unknown nested orgs 404 like the rest of the nested tree.
    """

    serializer_class = ActivityFrontendSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        base = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        queryset = cast(
            Any, self.filter_class(base, data=self.request.query_params).queryset
        )
        lookup = self.kwargs.get("organization_id")
        if not lookup:
            return queryset
        from apps.organization.selectors.organization import OrganizationSelector

        org = OrganizationSelector.resolve_by_lookup(lookup)
        if org is None:
            raise Http404("Organization not found.")
        user = getattr(self.request, "user", None)
        if user is not None and not (user.is_staff or user.is_superuser):
            from apps.organization.models import OrganizationMembership

            member = OrganizationMembership.objects.filter(
                user=user, organization=org, is_deleted=False
            ).exists()
            if not member:
                return queryset.none()
        return queryset.filter(organization=org)
