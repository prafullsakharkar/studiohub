from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.intelligence.models import RecentSearch, SavedSearch
from apps.intelligence.serializers import (
    RecentSearchSerializer,
    SavedSearchSerializer,
)
from apps.organization.middleware.organization_context import (
    resolve_organization_context,
)
from apps.organization.models import Organization


class DummySerializer(serializers.Serializer[Any]):
    pass


def _resolve_organization(request):
    """
    Resolve the search organization: explicit request context first,
    then the first org for staff (admin context).

    Non-staff callers must hold a live membership in the resolved org
    (fail closed); otherwise the client-supplied org header alone would
    scope another organization's data to the caller. Mirrors the
    membership gate in
    ``apps.audit.api.viewsets.activity.ActivityCompatViewSet``.
    """
    resolve_organization_context(request, force=True)
    organization = getattr(request, "organization", None)
    user = getattr(request, "user", None)
    if organization is None:
        if user is not None and (user.is_superuser):
            return Organization.objects.first()
        return None
    if user is not None and not (user.is_superuser):
        from apps.organization.models import OrganizationMembership

        member = OrganizationMembership.objects.filter(
            user=user, organization=organization, is_deleted=False
        ).exists()
        if not member:
            return None
    return organization


def _user_scoped_queryset(request, model):
    organization = _resolve_organization(request)
    user = getattr(request, "user", None)
    if organization is None or user is None or not user.is_authenticated:
        return model.objects.none()
    return model.objects.filter(organization=organization, user=user)


def _get_saved_search(request, pk):
    try:
        return _user_scoped_queryset(request, SavedSearch).filter(id=pk).first()
    except (DjangoValidationError, ValueError):
        return None


# DOCUMENTED-STUB (Phase 2 P1-4 verdict): global search across domain entities
# has no search-index backend yet, so it always returns the empty result shape.
# The frontend `SearchService` falls back to its in-memory index on empty
# results. REAL implementation (Postgres trigram, no Elasticsearch) is P2 —
# do not mistake these empty results for "no matches".
class IntelligenceSearchView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
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


class IntelligenceSearchSavedView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        searches = _user_scoped_queryset(request, SavedSearch)
        return Response(SavedSearchSerializer(searches, many=True).data)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        organization = _resolve_organization(request)
        if organization is None:
            return Response({"detail": "No organization found."}, status=404)
        serializer = SavedSearchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        search = serializer.save(organization=organization, user=request.user)
        return Response(SavedSearchSerializer(search).data, status=201)


class IntelligenceSearchSavedDetailView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, pk=None):
        search = _get_saved_search(request, pk)
        if search is None:
            return Response({"detail": "Not found."}, status=404)
        return Response(SavedSearchSerializer(search).data)

    def delete(self, request, pk=None):
        search = _get_saved_search(request, pk)
        if search is None:
            return Response({"detail": "Not found."}, status=404)
        search.soft_delete(user=getattr(request, "user", None))
        return Response(status=204)


class IntelligenceSearchRecentView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        searches = _user_scoped_queryset(request, RecentSearch)
        return Response(RecentSearchSerializer(searches, many=True).data)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        organization = _resolve_organization(request)
        if organization is None:
            return Response({"detail": "No organization found."}, status=404)
        serializer = RecentSearchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        query = validated.get("query") if isinstance(validated, dict) else ""
        if not (query or "").strip():
            return Response({"query": ["This field may not be blank."]}, status=400)
        search = serializer.save(organization=organization, user=request.user)
        return Response(RecentSearchSerializer(search).data, status=201)

    def delete(self, request):
        _user_scoped_queryset(request, RecentSearch).delete()
        return Response(status=204)
