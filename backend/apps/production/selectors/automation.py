from __future__ import annotations

from typing import Any
from uuid import UUID

from django.db.models import QuerySet

from apps.production.models import AutomationAuditLog, AutomationRule, Project, Workflow
from apps.production.selectors.base import ProductionBaseSelector


class AutomationRuleSelector(ProductionBaseSelector):
    """
    Automation rules, narrowed to the caller's project memberships.

    Rules without a project (platform-global rules) are visible to platform
    admins only: the membership scope has no project to match them against.
    """

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[AutomationRule]:
        qs = AutomationRule.objects.all()
        return cls.scope_by_project_membership(qs, request=request)

    @classmethod
    def get_by_id(cls, *, request, pk: Any) -> AutomationRule | None:
        """Scoped lookup; a malformed, unknown or out-of-scope id is ``None``."""
        try:
            rule_id = UUID(str(pk))
        except ValueError:
            return None
        return cls.get_queryset(request=request).filter(id=rule_id).first()

    @classmethod
    def resolve_project(cls, *, request, lookup: Any) -> Project | None:
        """
        Resolve the project a rule is written to.

        ``None`` when the value is unknown or the caller has no access to the
        project. Both cases look the same, so the answer reveals nothing about
        projects the caller is not a member of.
        """
        from apps.production.selectors.project import ProjectSelector

        project = ProjectSelector.resolve_by_lookup(lookup)
        if project is None or not cls.user_has_project_access(request=request, project=project):
            return None
        return project

    @classmethod
    def resolve_workflow(
        cls, *, request, lookup: Any, project: Project | None = None
    ) -> Workflow | None:
        """
        Workflow by UUID inside the caller's scope; anything else is ``None``.

        With ``project`` the workflow must belong to it.
        """
        try:
            workflow_id = UUID(str(lookup))
        except ValueError:
            return None
        qs = cls.scope_by_project_membership(
            Workflow.objects.select_related("project"), request=request
        )
        if project is not None:
            qs = qs.filter(project=project)
        return qs.filter(id=workflow_id).first()


class AutomationAuditLogSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[AutomationAuditLog]:
        qs = AutomationAuditLog.objects.all()
        return cls.scope_by_project_membership(qs, request=request)
