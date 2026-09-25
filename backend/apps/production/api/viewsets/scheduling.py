from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.organization.middleware.organization_context import (
    resolve_organization_context,
)
from apps.organization.models import Organization
from apps.production.api.serializers.automation import (
    AutomationAuditLogSerializer,
    AutomationRuleSerializer,
)
from apps.production.models import AutomationAuditLog, AutomationRule
from apps.production.services import automation as automation_service


class DummySerializer(serializers.Serializer[Any]):
    pass


def _resolve_organization(request):
    """
    Resolve the automation organization: explicit request context first,
    then the first org for staff (admin context).
    """
    resolve_organization_context(request, force=True)
    organization = getattr(request, "organization", None)
    if organization is not None:
        return organization
    user = getattr(request, "user", None)
    if user is not None and (user.is_superuser):
        return Organization.objects.first()
    return None


def _scoped_rules(request):
    organization = _resolve_organization(request)
    if organization is None:
        return AutomationRule.objects.none()
    return AutomationRule.objects.filter(organization=organization)


def _scoped_audit_logs(request):
    organization = _resolve_organization(request)
    if organization is None:
        return AutomationAuditLog.objects.none()
    return AutomationAuditLog.objects.filter(organization=organization)


def _get_rule(request, pk):
    try:
        return _scoped_rules(request).filter(id=pk).first()
    except (DjangoValidationError, ValueError):
        return None


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
        from apps.scheduling.selectors.capacity import get_capacity_summary

        organization = _resolve_organization(request)
        if organization is None:
            return Response([])
        return Response(get_capacity_summary(organization))


class SchedulingOverbookingView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        from apps.scheduling.selectors.capacity import get_overbooking_alerts

        organization = _resolve_organization(request)
        if organization is None:
            return Response([])
        return Response(get_overbooking_alerts(organization))


class SchedulingResolveOverbookingView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        from apps.scheduling.services.capacity import resolve_overbooking

        organization = _resolve_organization(request)
        if organization is None:
            return Response({"detail": "No organization found."}, status=404)
        data = request.data or {}
        if not data.get("alert_id"):
            return Response({"alert_id": ["This field is required."]}, status=400)
        try:
            result = resolve_overbooking(
                organization=organization,
                alert_id=data.get("alert_id"),
                resource_id=data.get("resource_id"),
            )
        except DjangoValidationError as exc:
            return Response({"detail": str(exc)}, status=400)
        if result is None:
            return Response({"detail": "Not found."}, status=404)
        return Response(result)


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
        rules = _scoped_rules(request)
        return Response(AutomationRuleSerializer(rules, many=True).data)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        organization = _resolve_organization(request)
        if organization is None:
            return Response({"detail": "No organization found."}, status=404)
        serializer = AutomationRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        data = dict(validated) if isinstance(validated, dict) else {}
        data["workflow_id"] = (request.data or {}).get("workflow_id")
        rule = automation_service.create_rule(
            organization=organization,
            user=request.user,
            data=data,
        )
        return Response(AutomationRuleSerializer(rule).data, status=201)


class AutomationRuleDetailView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, pk=None):
        rule = _get_rule(request, pk)
        if rule is None:
            return Response({"detail": "Not found."}, status=404)
        return Response(AutomationRuleSerializer(rule).data)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def patch(self, request, pk=None):
        rule = _get_rule(request, pk)
        if rule is None:
            return Response({"detail": "Not found."}, status=404)
        serializer = AutomationRuleSerializer(instance=rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        data = dict(validated) if isinstance(validated, dict) else {}
        if (request.data or {}).get("workflow_id") is not None:
            data["workflow_id"] = request.data.get("workflow_id")
        rule = automation_service.update_rule(rule=rule, data=data)
        return Response(AutomationRuleSerializer(rule).data)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def put(self, request, pk=None):
        rule = _get_rule(request, pk)
        if rule is None:
            return Response({"detail": "Not found."}, status=404)
        serializer = AutomationRuleSerializer(instance=rule, data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        data = dict(validated) if isinstance(validated, dict) else {}
        data["workflow_id"] = (request.data or {}).get("workflow_id")
        rule = automation_service.update_rule(rule=rule, data=data)
        return Response(AutomationRuleSerializer(rule).data)

    def delete(self, request, pk=None):
        rule = _get_rule(request, pk)
        if rule is None:
            return Response({"detail": "Not found."}, status=404)
        automation_service.delete_rule(rule=rule, user=getattr(request, "user", None))
        return Response(status=204)


class AutomationAuditLogsView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        logs = _scoped_audit_logs(request)
        return Response(AutomationAuditLogSerializer(logs, many=True).data)
