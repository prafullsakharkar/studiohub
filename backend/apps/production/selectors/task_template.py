"""Task templates the caller may see: the studio's, and those of their own projects."""

from __future__ import annotations

from typing import Any

from django.db.models import Prefetch, Q, QuerySet

from apps.core.selectors.base import BaseSelector
from apps.production.models import TaskTemplate, TaskTemplateItem
from apps.production.selectors.base import ProductionBaseSelector


class TaskTemplateSelector(BaseSelector):
    model = TaskTemplate

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any, Any]:
        """Studio-wide templates for everyone; project templates for the project's members."""
        queryset = TaskTemplate.objects.select_related("project").prefetch_related(
            Prefetch("items", queryset=TaskTemplateItem.objects.select_related("task_type"))
        )
        if request is None:
            return queryset
        project_ids = ProductionBaseSelector.visible_project_ids(request)
        if project_ids is None:  # platform admins
            return queryset
        return queryset.filter(Q(project__isnull=True) | Q(project_id__in=project_ids))
