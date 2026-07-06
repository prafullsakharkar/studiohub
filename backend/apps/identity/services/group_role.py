from apps.core.services.business import (
    BusinessService,
)
from apps.identity.events import (
    GroupRoleCreated,
    GroupRoleDeleted,
)
from apps.identity.models import (
    GroupRole,
)
from apps.identity.services.permission_cache import (
    PermissionCacheService,
)
from apps.identity.validators.group_role import (
    GroupRoleValidator,
)


class GroupRoleService(
    BusinessService,
):

    model = GroupRole

    validator_class = GroupRoleValidator

    event_map = {
        "create": GroupRoleCreated,
        "delete": GroupRoleDeleted,
    }

    @classmethod
    def invalidate_cache(
        cls,
        instance,
    ):
        for user in instance.group.users.all():
            PermissionCacheService.invalidate(
                user=user,
            )
