from apps.core.services.business import BusinessService
from apps.organization.events import (
    UserRoleAssigned,
    UserRoleRevoked,
)
from apps.organization.validators.user_role import UserRoleValidator


class UserRoleService(BusinessService):
    """
    Service for UserRole model.
    """

    model = None
    validator_class = UserRoleValidator

    event_map = {
        "create": UserRoleAssigned,
        "update": UserRoleAssigned,
        "delete": UserRoleRevoked,
    }
