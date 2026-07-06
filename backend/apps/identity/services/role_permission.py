from apps.core.services.business import (
    BusinessService,
)
from apps.identity.events import (
    RolePermissionCreated,
    RolePermissionDeleted,
)
from apps.identity.models import (
    RolePermission,
)
from apps.identity.services.permission_cache import (
    PermissionCacheService,
)
from apps.identity.validators.role_permission import (
    RolePermissionValidator,
)


class RolePermissionService(
    BusinessService,
):

    model = RolePermission

    validator_class = RolePermissionValidator

    event_map = {
        "create": RolePermissionCreated,
        "delete": RolePermissionDeleted,
    }

    @classmethod
    def invalidate_cache(
        cls,
        instance,
    ):
        # Invalidate all users having this role (implement lookup as needed)
        pass
