"""
Knowledge-base endpoints backed by the ``KnowledgeDocument`` model.

Same URL contract as the former in-memory stub store, now persisted per
organization. List responses stay bare arrays.
"""

from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import F, Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.intelligence.models import KnowledgeDocument
from apps.intelligence.serializers import (
    KnowledgeDocumentSerializer,
    KnowledgeDocumentUpdateSerializer,
)
from apps.organization.middleware.organization_context import (
    resolve_organization_context,
)
from apps.organization.models import Organization


class DummySerializer(serializers.Serializer[Any]):
    pass


def _resolve_organization(request):
    """
    Resolve the knowledge organization: explicit request context first,
    then the first org for staff (admin context).
    """
    resolve_organization_context(request, force=True)
    organization = getattr(request, "organization", None)
    if organization is not None:
        return organization
    user = getattr(request, "user", None)
    if user is not None and (user.is_staff or user.is_superuser):
        return Organization.objects.first()
    return None


def _scoped_queryset(request):
    organization = _resolve_organization(request)
    if organization is None:
        return KnowledgeDocument.objects.none()
    return KnowledgeDocument.objects.filter(organization=organization)


def _get_doc(request, pk):
    try:
        return _scoped_queryset(request).filter(id=pk).first()
    except (DjangoValidationError, ValueError):
        return None


class IntelligenceKnowledgeListView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        category = request.query_params.get("category")
        search = request.query_params.get("search")
        docs = _scoped_queryset(request)
        if category and category != "ALL":
            docs = docs.filter(category=category)
        if search:
            docs = docs.filter(Q(title__icontains=search) | Q(summary__icontains=search))
        return Response(KnowledgeDocumentSerializer(docs, many=True).data)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        organization = _resolve_organization(request)
        if organization is None:
            return Response({"detail": "No organization found."}, status=404)
        serializer = KnowledgeDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        doc = serializer.save(organization=organization)
        return Response(KnowledgeDocumentSerializer(doc).data, status=201)


class IntelligenceKnowledgeDetailView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, pk=None):
        doc = _get_doc(request, pk)
        if doc is None:
            return Response({"detail": "Not found."}, status=404)
        KnowledgeDocument.objects.filter(pk=doc.pk).update(views_count=F("views_count") + 1)
        doc.refresh_from_db()
        return Response(KnowledgeDocumentSerializer(doc).data)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def patch(self, request, pk=None):
        doc = _get_doc(request, pk)
        if doc is None:
            return Response({"detail": "Not found."}, status=404)
        serializer = KnowledgeDocumentUpdateSerializer(
            instance=doc, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        doc.refresh_from_db()
        return Response(KnowledgeDocumentSerializer(doc).data)

    def delete(self, request, pk=None):
        doc = _get_doc(request, pk)
        if doc is None:
            return Response({"detail": "Not found."}, status=404)
        doc.soft_delete(user=getattr(request, "user", None))
        return Response(status=204)


class IntelligenceKnowledgeLikeView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def post(self, request, pk=None):
        doc = _get_doc(request, pk)
        if doc is None:
            return Response({"detail": "Not found."}, status=404)
        KnowledgeDocument.objects.filter(pk=doc.pk).update(likes_count=F("likes_count") + 1)
        doc.refresh_from_db()
        return Response({"likes_count": doc.likes_count})


class IntelligenceKnowledgeLinkEntityView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request, pk=None):
        doc = _get_doc(request, pk)
        if doc is None:
            return Response({"detail": "Not found."}, status=404)
        links = list(doc.linked_entities or [])
        link = {"id": f"klink-{len(links) + 1}", **request.data}
        links.append(link)
        doc.linked_entities = links
        doc.save(update_fields=["linked_entities", "updated_at"])
        doc.refresh_from_db()
        return Response(KnowledgeDocumentSerializer(doc).data)

    def delete(self, request, pk=None, link_id=None):
        doc = _get_doc(request, pk)
        if doc is None:
            return Response({"detail": "Not found."}, status=404)
        doc.linked_entities = [
            e for e in (doc.linked_entities or []) if e.get("id") != link_id
        ]
        doc.save(update_fields=["linked_entities", "updated_at"])
        doc.refresh_from_db()
        return Response(KnowledgeDocumentSerializer(doc).data)
