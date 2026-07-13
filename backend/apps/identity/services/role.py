from apps.core.services.business import (
    BusinessService,
)
from apps.identity.events import (
    RoleActivated,
    RoleArchived,
    RoleCreated,
    RoleDeactivated,
    RoleDeleted,
    RoleRestored,
    RoleUpdated,
)
from apps.identity.models import (
    Role,
)
from apps.identity.validators.role import (
    RoleValidator,
)


class RoleService(
    BusinessService,
):
    """
    Write operations for Role.
    """

    model = Role

    validator_class = RoleValidator

    event_map = {
        "create": RoleCreated,
        "update": RoleUpdated,
        "delete": RoleDeleted,
        "restore": RoleRestored,
        "archive": RoleArchived,
        "activate": RoleActivated,
        "deactivate": RoleDeactivated,
    }
