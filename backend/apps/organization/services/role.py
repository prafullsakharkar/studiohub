from apps.core.services.business import BusinessService
from apps.organization.events import (
    RoleCreated,
    RoleDeleted,
    RoleUpdated,
)
from apps.organization.validators.role import RoleValidator


class RoleService(BusinessService):
    """
    Service for Role model.
    """

    model = None
    validator_class = RoleValidator

    event_map = {
        "create": RoleCreated,
        "update": RoleUpdated,
        "delete": RoleDeleted,
    }
