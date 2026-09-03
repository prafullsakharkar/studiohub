from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class IntelligenceAnalyticsDashboardView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, domain=None):
        # domain is the last path segment (projects, production, etc.)
        return Response({
            "domain": domain or "projects",
            "kpis": [
                {"label": "Shots Completed", "value": 50, "target": 100, "delta_percentage": -2, "trend": "stable", "status": "on_track"},
            ],
            "charts": [],
            "generated_at": "2026-08-20T00:00:00Z",
        })
