from apps.core.services.business import (
    BusinessService,
)
from apps.identity.events import (
    UserActivated,
    UserArchived,
    UserCreated,
    UserDeactivated,
    UserDeleted,
    UserRestored,
    UserUpdated,
)
from apps.identity.models import (
    User,
)
from apps.identity.validators.user import (
    UserValidator,
)


class UserService(
    BusinessService,
):
    """
    Write operations for User.
    """

    model = User

    validator_class = UserValidator

    event_map = {
        "create": UserCreated,
        "update": UserUpdated,
        "delete": UserDeleted,
        "restore": UserRestored,
        "archive": UserArchived,
        "activate": UserActivated,
        "deactivate": UserDeactivated,
    }
