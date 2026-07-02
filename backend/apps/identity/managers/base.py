from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.base import IdentityQuerySet

IdentityManager = BaseManager.from_queryset(IdentityQuerySet)
