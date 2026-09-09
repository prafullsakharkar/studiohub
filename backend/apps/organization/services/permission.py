from apps.core.services.business import BusinessService
from apps.organization.events import (
    PermissionCreated,
    PermissionDeleted,
    PermissionUpdated,
)
from apps.organization.validators.permission import PermissionValidator


class PermissionService(BusinessService):
    """
    Service for Permission model.
    """

    model = None
    validator_class = PermissionValidator

    event_map = {
        "create": PermissionCreated,
        "update": PermissionUpdated,
        "delete": PermissionDeleted,
    }
