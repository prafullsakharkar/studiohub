from apps.core.services.business import BusinessService
from apps.organization.events import (
    GroupMemberAdded,
    GroupMemberRemoved,
    GroupMemberUpdated,
)
from apps.organization.models import GroupMember
from apps.organization.validators.group_member import GroupMemberValidator


class GroupMemberService(BusinessService):
    """
    Service for GroupMember model.
    """

    model = GroupMember
    validator_class = GroupMemberValidator

    event_map = {
        "create": GroupMemberAdded,
        "update": GroupMemberUpdated,
        "delete": GroupMemberRemoved,
    }
