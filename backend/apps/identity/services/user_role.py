from apps.core.services.business import (
    BusinessService,
)
from apps.identity.events import (
    UserRoleCreated,
    UserRoleDeleted,
)
from apps.identity.models import (
    UserRole,
)
from apps.identity.services.permission_cache import (
    PermissionCacheService,
)
from apps.identity.validators.user_role import (
    UserRoleValidator,
)


class UserRoleService(
    BusinessService,
):

    model = UserRole

    validator_class = UserRoleValidator

    event_map = {
        "create": UserRoleCreated,
        "delete": UserRoleDeleted,
    }

    @classmethod
    def invalidate_cache(
        cls,
        instance,
    ):
        PermissionCacheService.invalidate(
            user=instance.user,
        )
