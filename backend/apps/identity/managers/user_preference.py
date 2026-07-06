from apps.core.models.managers.base import (
    BaseManager,
)
from apps.identity.querysets.user_preference import (
    UserPreferenceQuerySet,
)

UserPreferenceManager = BaseManager.from_queryset(
    UserPreferenceQuerySet,
)
