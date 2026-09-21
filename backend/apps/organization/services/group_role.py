from apps.core.services.business import BusinessService
from apps.organization.events import (
    GroupRoleAdded,
    GroupRoleRemoved,
    GroupRoleUpdated,
)
from apps.organization.models import GroupRole
from apps.organization.validators.group_role import GroupRoleValidator


class GroupRoleService(BusinessService):
    """
    Service for GroupRole model.
    """

    model = GroupRole
    validator_class = GroupRoleValidator

    event_map = {
        "create": GroupRoleAdded,
        "update": GroupRoleUpdated,
        "delete": GroupRoleRemoved,
    }

    @classmethod
    def invalidate_cache(cls, instance):
        super().invalidate_cache(instance)
        from apps.identity.services.permission_cache import PermissionCacheService

        PermissionCacheService.invalidate_group_members(
            getattr(instance, "group_id", None)
        )
