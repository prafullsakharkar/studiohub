from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.position import (
    PositionQuerySet,
)

PositionManager = BaseManager.from_queryset(
    PositionQuerySet,
)
