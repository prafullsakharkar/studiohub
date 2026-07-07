from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.login_attempt import (
    LoginAttemptQuerySet,
)

LoginAttemptManager = BaseManager.from_queryset(
    LoginAttemptQuerySet,
)
