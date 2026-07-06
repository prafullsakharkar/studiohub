from apps.core.services.business import (
    BusinessService,
)
from apps.identity.events import (
    GroupActivated,
    GroupArchived,
    GroupCreated,
    GroupDeactivated,
    GroupDeleted,
    GroupRestored,
    GroupUpdated,
)
from apps.identity.models import (
    Group,
)
from apps.identity.validators.group import (
    GroupValidator,
)


class GroupService(
    BusinessService,
):

    model = Group

    validator_class = GroupValidator

    event_map = {
        "create": GroupCreated,
        "update": GroupUpdated,
        "delete": GroupDeleted,
        "restore": GroupRestored,
        "archive": GroupArchived,
        "activate": GroupActivated,
        "deactivate": GroupDeactivated,
    }
