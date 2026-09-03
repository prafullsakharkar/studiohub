from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class DummySerializer(serializers.Serializer):
    pass
# For now, intelligence search is a thin proxy that returns the same mock index
# that the frontend previously built locally. In a real implementation, this would
# query a search index (e.g., Elasticsearch) that indexes all domain entities.
# We return a stub that matches the frontend's expected shape.

class IntelligenceSearchView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        responses=OpenApiTypes.OBJECT,
        description="Global search across all entity types (projects, shots, assets, tasks, knowledge, etc.)",
    )
    def get(self, request):
        # Query params: query, entity_types, project_codes, etc.
        # For now, return empty results with facets structure matching frontend
        query = request.query_params.get("query", "")
        return Response({
            "results": [],
            "facets": {
                "entity_types": [],
                "projects": [],
                "organizations": [],
                "departments": [],
                "statuses": [],
                "tags": [],
            },
            "total": 0,
            "query": query,
        })

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        # POST version for complex filters (SearchFilters)
        filters = request.data
        query = filters.get("query", "")
        return Response({
            "results": [],
            "facets": {
                "entity_types": [],
                "projects": [],
                "organizations": [],
                "departments": [],
                "statuses": [],
                "tags": [],
            },
            "total": 0,
            "query": query,
        })


class IntelligenceSearchSavedView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([])

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        return Response({"id": "save-001", **request.data, "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z"}, status=201)


class IntelligenceSearchSavedDetailView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    def delete(self, request, pk=None):
        return Response(status=204)


class IntelligenceSearchRecentView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([])

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        return Response({"id": "rec-001", **request.data, "timestamp": "2026-01-01T00:00:00Z"}, status=201)

    def delete(self, request):
        return Response(status=204)
