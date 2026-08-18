from apps.core.services.business import BusinessService
from apps.organization.events import (
    GroupCreated,
    GroupDeleted,
    GroupUpdated,
)
from apps.organization.validators.group import GroupValidator


class GroupService(BusinessService):
    """
    Service for Group model.
    """

    model = None
    validator_class = GroupValidator

    event_map = {
        "create": GroupCreated,
        "update": GroupUpdated,
        "delete": GroupDeleted,
    }
