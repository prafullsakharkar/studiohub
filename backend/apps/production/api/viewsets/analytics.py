from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class DummySerializer(serializers.Serializer):
    pass


class AnalyticsKpisView(GenericAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(
            {
                "total_shots": 100,
                "approved_shots": 50,
                "pending_review_shots": 20,
                "approval_rate_percentage": 50.0,
                "storage_usage_tb": 2.5,
                "quota_tb": 10,
                "render_nodes_busy": 5,
                "render_nodes_total": 10,
                "avg_render_time_mins": 120,
            }
        )


class AnalyticsDepartmentsView(GenericAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(
            [
                {"department": "FX", "total_tasks": 100, "completed_tasks": 50, "percentage": 50},
                {"department": "Comp", "total_tasks": 80, "completed_tasks": 40, "percentage": 50},
            ]
        )
