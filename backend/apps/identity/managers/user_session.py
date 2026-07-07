from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.user_session import (
    UserSessionQuerySet,
)

UserSessionManager = BaseManager.from_queryset(
    UserSessionQuerySet,
)
