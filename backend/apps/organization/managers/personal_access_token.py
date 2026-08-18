from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.personal_access_token import (
    PersonalAccessTokenQuerySet,
)

PersonalAccessTokenManager = BaseManager.from_queryset(
    PersonalAccessTokenQuerySet
)
