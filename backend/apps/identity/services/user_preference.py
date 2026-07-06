from apps.core.services.business import (
    BusinessService,
)
from apps.identity.events import (
    UserPreferenceActivated,
    UserPreferenceArchived,
    UserPreferenceCreated,
    UserPreferenceDeactivated,
    UserPreferenceDeleted,
    UserPreferenceRestored,
    UserPreferenceUpdated,
)
from apps.identity.models import (
    UserPreference,
)
from apps.identity.validators.user_preference import (
    UserPreferenceValidator,
)


class UserPreferenceService(
    BusinessService,
):
    """
    Write operations for UserPreference.
    """

    model = UserPreference

    validator_class = UserPreferenceValidator

    event_map = {
        "create": UserPreferenceCreated,
        "update": UserPreferenceUpdated,
        "delete": UserPreferenceDeleted,
        "restore": UserPreferenceRestored,
        "archive": UserPreferenceArchived,
        "activate": UserPreferenceActivated,
        "deactivate": UserPreferenceDeactivated,
    }
