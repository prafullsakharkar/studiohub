from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.office import (
    OfficeQuerySet,
)

OfficeManager = BaseManager.from_queryset(OfficeQuerySet)
