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

    # Reads stay open to authenticated users (org-scoped selectors).
    permission_map = {
        "list": (),
        "retrieve": (),
    }
    service_class = ActivityService
    selector_class = ActivitySelector
    filter_class = ActivityFilter
    
    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).qs


class ActivityCompatViewSet(ActivityViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Frontend-contract activity feed (Phase 3 gap P1-3).

    Serves ``GET /api/v1/activity/`` (flat) as a paginated
    ``{count, next, previous, results}`` feed in the frontend shape
    (``useOrganizationActivity`` reads ``results[]``).

    Platform-global: the feed carries no tenant partition. The legacy
    nested ``/api/organizations/<org>/activity/`` route (owned by the
    organization app, removed with it in B7) 404s — organization IDs no
    longer address anything.
    """

    serializer_class = ActivityFrontendSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        base = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        queryset = cast(
            Any, self.filter_class(base, data=self.request.query_params).qs
        )
        if self.kwargs.get("organization_id"):
            raise Http404("Organization not found.")
        return queryset
