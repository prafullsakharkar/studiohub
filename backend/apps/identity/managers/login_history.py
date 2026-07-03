from apps.core.managers.base import BaseManager
from apps.identity.querysets.login_history import (
    LoginHistoryQuerySet,
)

LoginHistoryManager = BaseManager.from_queryset(
    LoginHistoryQuerySet,
)
