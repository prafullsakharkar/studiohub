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
