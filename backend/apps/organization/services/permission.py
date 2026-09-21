from apps.core.services.business import BusinessService
from apps.organization.events import (
    PermissionCreated,
    PermissionDeleted,
    PermissionUpdated,
)
from apps.organization.validators.permission import PermissionValidator


class PermissionService(BusinessService):
    """
    Service for Permission model.
    """

    model = None
    validator_class = PermissionValidator

    event_map = {
        "create": PermissionCreated,
        "update": PermissionUpdated,
        "delete": PermissionDeleted,
    }

    @classmethod
    def invalidate_cache(cls, instance):
        super().invalidate_cache(instance)
        from apps.identity.services.permission_cache import PermissionCacheService

        PermissionCacheService.invalidate_permission_holders(instance)
