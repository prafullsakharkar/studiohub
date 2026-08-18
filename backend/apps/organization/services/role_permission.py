from apps.core.services.business import BusinessService
from apps.organization.events import (
    RolePermissionGranted,
    RolePermissionRevoked,
    RolePermissionUpdated,
)
from apps.organization.validators.role_permission import RolePermissionValidator


class RolePermissionService(BusinessService):
    """
    Service for RolePermission model.
    """

    model = None
    validator_class = RolePermissionValidator

    event_map = {
        "create": RolePermissionGranted,
        "update": RolePermissionUpdated,
        "delete": RolePermissionRevoked,
    }
