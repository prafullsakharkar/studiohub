from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.department import DepartmentQuerySet

DepartmentManager = BaseManager.from_queryset(DepartmentQuerySet)
