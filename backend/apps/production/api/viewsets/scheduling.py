from typing import Any

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class DummySerializer(serializers.Serializer[Any]):
    pass


class SchedulingEventsView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([])

    @extend_schema(request=DummySerializer, responses=DummySerializer)
    def post(self, request):
        return Response({"id": "evt-001", **request.data}, status=201)


class SchedulingEventDetailView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, pk=None):
        return Response({"id": pk})

    @extend_schema(request=DummySerializer, responses=DummySerializer)
    def patch(self, request, pk=None):
        return Response({"id": pk, **request.data})

    @extend_schema(request=DummySerializer, responses=DummySerializer)
    def put(self, request, pk=None):
        return Response({"id": pk, **request.data})

    def delete(self, request, pk=None):
        return Response(status=204)


class SchedulingResourcesView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([])

    @extend_schema(request=DummySerializer, responses=DummySerializer)
    def patch(self, request, pk=None):
        return Response({"id": pk, **request.data})


class SchedulingCapacityView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([])


class SchedulingOverbookingView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([])


class SchedulingResolveOverbookingView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(request=DummySerializer, responses=DummySerializer)
    def post(self, request):
        return Response({"success": True, "message": "Resolved"})


class SchedulingHolidaysView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([])


class SchedulingLeavesView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([])

    @extend_schema(request=DummySerializer, responses=DummySerializer)
    def post(self, request):
        return Response({"id": "leave-001", **request.data}, status=201)


class AutomationRulesView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([])

    @extend_schema(request=DummySerializer, responses=DummySerializer)
    def post(self, request):
        return Response({"id": "rule-001", **request.data}, status=201)


class AutomationRuleDetailView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(request=DummySerializer, responses=DummySerializer)
    def patch(self, request, pk=None):
        return Response({"id": pk, **request.data})

    @extend_schema(request=DummySerializer, responses=DummySerializer)
    def put(self, request, pk=None):
        return Response({"id": pk, **request.data})

    def delete(self, request, pk=None):
        return Response(status=204)


class AutomationAuditLogsView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([])
