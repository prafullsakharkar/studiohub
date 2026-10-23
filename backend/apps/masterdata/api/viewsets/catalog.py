"""
Platform overview endpoint.

The catalog viewsets (types, statuses, software and versions) live in
``lookup.py``. The overview returns bare statistics, no pagination, to match
the frontend contract.
"""

from __future__ import annotations

from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.viewsets.base import BaseViewSet
from apps.masterdata.services.resolution import get_platform_overview


class PlatformOverviewViewSet(BaseViewSet):
    pagination_class = None

    @action(detail=False, methods=["get"], url_path="overview")
    def overview(self, request):
        return Response(get_platform_overview())
