from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.api_key import (
    APIKeyQuerySet,
)

APIKeyManager = BaseManager.from_queryset(
    APIKeyQuerySet,
)
