from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.invitation import (
    InvitationQuerySet,
)

InvitationManager = BaseManager.from_queryset(
    InvitationQuerySet,
)
