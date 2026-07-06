from apps.core.services.business import (
    BusinessService,
)
from apps.identity.events import (
    GroupMemberCreated,
    GroupMemberDeleted,
    GroupMemberRestored,
    GroupMemberUpdated,
)
from apps.identity.models import (
    GroupMember,
)
from apps.identity.services.permission_cache import (
    PermissionCacheService,
)
from apps.identity.validators.group_member import (
    GroupMemberValidator,
)


class GroupMemberService(
    BusinessService,
):

    model = GroupMember

    validator_class = GroupMemberValidator

    created_event = GroupMemberCreated
    updated_event = GroupMemberUpdated
    deleted_event = GroupMemberDeleted
    restored_event = GroupMemberRestored

    @classmethod
    def invalidate_cache(
        cls,
        instance,
    ):
        PermissionCacheService.invalidate(
            user=instance.user,
        )
