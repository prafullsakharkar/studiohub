from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class DummySerializer(serializers.Serializer):
    pass
# Stub knowledge documents — mirrors frontend mockKnowledgeDocuments
MOCK_KNOWLEDGE = [
    {
        "id": "kdoc-001",
        "title": "OpenUSD 24.08 Multi-Department Asset Composition Standard",
        "slug": "openusd-24-08-standard",
        "summary": "Authoring and payload conventions for high-density assets.",
        "content_markdown": "# OpenUSD Standard\n...",
        "category": "pipeline",
        "department_name": "Pipeline",
        "project_code": "ALL",
        "tags": ["USD", "OpenUSD", "Karma"],
        "author_name": "Pipeline TD",
        "author_role": "Pipeline TD",
        "version": "1.0",
        "views_count": 42,
        "likes_count": 12,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "linked_entities": [],
    }
]

class IntelligenceKnowledgeListView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        category = request.query_params.get("category")
        search = request.query_params.get("search")
        docs = MOCK_KNOWLEDGE
        if category and category != "ALL":
            docs = [d for d in docs if d["category"] == category]
        if search:
            q = search.lower()
            docs = [d for d in docs if q in d["title"].lower() or q in d["summary"].lower()]
        return Response(docs)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        new_doc = {
            "id": f"kdoc-{len(MOCK_KNOWLEDGE)+1}",
            **request.data,
            "views_count": 1,
            "likes_count": 0,
            "linked_entities": [],
        }
        MOCK_KNOWLEDGE.insert(0, new_doc)
        return Response(new_doc, status=201)

class IntelligenceKnowledgeDetailView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, pk=None):
        doc = next((d for d in MOCK_KNOWLEDGE if d["id"] == pk), None)
        if not doc:
            return Response({"detail": "Not found."}, status=404)
        doc["views_count"] = doc.get("views_count", 0) + 1
        return Response(doc)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def patch(self, request, pk=None):
        doc = next((d for d in MOCK_KNOWLEDGE if d["id"] == pk), None)
        if not doc:
            return Response({"detail": "Not found."}, status=404)
        doc.update(request.data)
        return Response(doc)

    def delete(self, request, pk=None):
        global MOCK_KNOWLEDGE
        MOCK_KNOWLEDGE = [d for d in MOCK_KNOWLEDGE if d["id"] != pk]
        return Response(status=204)


class IntelligenceKnowledgeLikeView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def post(self, request, pk=None):
        doc = next((d for d in MOCK_KNOWLEDGE if d["id"] == pk), None)
        if not doc:
            return Response({"detail": "Not found."}, status=404)
        doc["likes_count"] = doc.get("likes_count", 0) + 1
        return Response({"likes_count": doc["likes_count"]})


class IntelligenceKnowledgeLinkEntityView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request, pk=None):
        doc = next((d for d in MOCK_KNOWLEDGE if d["id"] == pk), None)
        if not doc:
            return Response({"detail": "Not found."}, status=404)
        link = {"id": f"klink-{len(doc.get('linked_entities', []))+1}", **request.data}
        doc.setdefault("linked_entities", []).append(link)
        return Response(doc)

    def delete(self, request, pk=None, link_id=None):
        doc = next((d for d in MOCK_KNOWLEDGE if d["id"] == pk), None)
        if not doc:
            return Response({"detail": "Not found."}, status=404)
        doc["linked_entities"] = [
            e for e in doc.get("linked_entities", []) if e.get("id") != link_id
        ]
        return Response(doc)
