from apps.core.managers import BaseManager
from apps.identity.querysets.user_mfa import UserMFAQuerySet


class UserMFAManager(BaseManager.from_queryset(UserMFAQuerySet)):
    """Manager for UserMFA."""
