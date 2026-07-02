from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.membership import (
    MembershipQuerySet,
)

MembershipManager = BaseManager.from_queryset(MembershipQuerySet)
