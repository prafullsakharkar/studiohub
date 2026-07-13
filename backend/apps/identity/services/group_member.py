from apps.core.services.business import (
    BusinessService,
)
from apps.identity.events import (
    GroupMemberActivated,
    GroupMemberArchived,
    GroupMemberCreated,
    GroupMemberDeactivated,
    GroupMemberDeleted,
    GroupMemberRestored,
    GroupMemberUpdated,
)
from apps.identity.models import (
    GroupMember,
)
from apps.identity.validators.group_member import (
    GroupMemberValidator,
)


class GroupMemberService(
    BusinessService,
):
    """
    Write operations for GroupMember.
    """

    model = GroupMember

    validator_class = GroupMemberValidator

    event_map = {
        "create": GroupMemberCreated,
        "update": GroupMemberUpdated,
        "delete": GroupMemberDeleted,
        "restore": GroupMemberRestored,
        "archive": GroupMemberArchived,
        "activate": GroupMemberActivated,
        "deactivate": GroupMemberDeactivated,
    }
