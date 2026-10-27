from typing import Any, ClassVar
from uuid import UUID

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.identity.permissions import HasPermission
from apps.production.api.serializers.automation import (
    AutomationAuditLogSerializer,
    AutomationRuleSerializer,
)
from apps.production.constants.permissions import AutomationPermissions
from apps.production.selectors.automation import (
    AutomationAuditLogSelector,
    AutomationRuleSelector,
)
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.services import automation as automation_service


class MethodPermissionMixin:
    """
    Permission codes by HTTP method, checked by ``HasPermission`` (fail closed: a method
    without an entry is denied).
    """

    permission_classes = (IsAuthenticated, HasPermission)
    permission_map: ClassVar[dict[str, tuple[str, ...]]] = {}
    request: Any  # pyright: ignore[reportUninitializedInstanceVariable]

    def get_permission_required(self):
        method = (self.request.method or "").lower()
        if method == "head":
            method = "get"
        return self.permission_map.get(method)


class _AutomationView(MethodPermissionMixin, GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    """
    Shared access rules for the automation endpoints.

    Authorization is the ``automation.*`` permission codes AND the caller's
    project memberships (``AutomationRuleSelector`` scoping). A rule outside
    that scope answers 404, like an unknown id. Rules without a project are
    platform-global: only platform admins see or write them.
    """

    @staticmethod
    def _uuid_or_none(value):
        try:
            return UUID(str(value))
        except ValueError:
            return None

    def _workflow_from(self, raw, *, project):
        """
        Resolve ``workflow_id`` from the payload inside the caller's scope.

        Mock-style ids (``wf-001``) are not UUIDs and are ignored (frontend
        contract). A UUID outside the caller's scope, or from another project
        than the rule's, is rejected with the same error as an unknown one.
        """
        if not raw or self._uuid_or_none(raw) is None:
            return None
        workflow = AutomationRuleSelector.resolve_workflow(
            request=self.request, lookup=raw, project=project
        )
        if workflow is None:
            raise ValidationError({"workflow_id": ["Unknown workflow."]})
        return workflow


class AutomationRulesView(_AutomationView):
    serializer_class = AutomationRuleSerializer
    permission_map = {
        "get": (AutomationPermissions.VIEW,),
        "post": (AutomationPermissions.CREATE,),
    }

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        rules = AutomationRuleSelector.get_queryset(request=request)
        return Response(AutomationRuleSerializer(rules, many=True).data)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        serializer = AutomationRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        data = dict(validated) if isinstance(validated, dict) else {}
        body = request.data or {}

        project = None
        raw_project = body.get("project_id")
        if raw_project not in (None, ""):
            project = AutomationRuleSelector.resolve_project(request=request, lookup=raw_project)
            if project is None:
                raise ValidationError({"project_id": ["Unknown project."]})
        workflow = self._workflow_from(body.get("workflow_id"), project=project)
        if project is None and workflow is not None:
            project = workflow.project
        if project is None and not ProductionBaseSelector.is_platform_admin(request.user):
            raise ValidationError({"project_id": ["A project is required."]})

        rule = automation_service.create_rule(
            user=request.user,
            data=data,
            project=project,
            workflow=workflow,
        )
        return Response(AutomationRuleSerializer(rule).data, status=201)


class AutomationRuleDetailView(_AutomationView):
    serializer_class = AutomationRuleSerializer
    permission_map = {
        "get": (AutomationPermissions.VIEW,),
        "patch": (AutomationPermissions.UPDATE,),
        "put": (AutomationPermissions.UPDATE,),
        "delete": (AutomationPermissions.DELETE,),
    }

    def _rule_or_404(self, pk):
        rule = AutomationRuleSelector.get_by_id(request=self.request, pk=pk)
        if rule is None:
            raise NotFound("Not found.")
        return rule

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, pk=None):
        return Response(AutomationRuleSerializer(self._rule_or_404(pk)).data)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def patch(self, request, pk=None):
        rule = self._rule_or_404(pk)
        serializer = AutomationRuleSerializer(instance=rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        data = dict(validated) if isinstance(validated, dict) else {}
        kwargs = {}
        raw_workflow = (request.data or {}).get("workflow_id")
        if raw_workflow is not None:
            kwargs["workflow"] = self._workflow_from(raw_workflow, project=rule.project)
        rule = automation_service.update_rule(rule=rule, data=data, user=request.user, **kwargs)
        return Response(AutomationRuleSerializer(rule).data)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def put(self, request, pk=None):
        rule = self._rule_or_404(pk)
        serializer = AutomationRuleSerializer(instance=rule, data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        data = dict(validated) if isinstance(validated, dict) else {}
        workflow = self._workflow_from(
            (request.data or {}).get("workflow_id"), project=rule.project
        )
        rule = automation_service.update_rule(
            rule=rule, data=data, user=request.user, workflow=workflow
        )
        return Response(AutomationRuleSerializer(rule).data)

    def delete(self, request, pk=None):
        rule = self._rule_or_404(pk)
        automation_service.delete_rule(rule=rule, user=request.user)
        return Response(status=204)


class AutomationAuditLogsView(_AutomationView):
    serializer_class = AutomationAuditLogSerializer
    permission_map = {"get": (AutomationPermissions.VIEW,)}

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        logs = AutomationAuditLogSelector.get_queryset(request=request)
        return Response(AutomationAuditLogSerializer(logs, many=True).data)
