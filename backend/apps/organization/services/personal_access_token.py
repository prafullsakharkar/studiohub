from apps.core.services.business import BusinessService
from apps.organization.events import (
    PersonalAccessTokenCreated,
    PersonalAccessTokenDeleted,
    PersonalAccessTokenUpdated,
)
from apps.organization.validators.personal_access_token import (
    PersonalAccessTokenValidator,
)


class PersonalAccessTokenService(BusinessService):
    """
    Service for PersonalAccessToken model.
    """

    model = None
    validator_class = PersonalAccessTokenValidator

    event_map = {
        "create": PersonalAccessTokenCreated,
        "update": PersonalAccessTokenUpdated,
        "delete": PersonalAccessTokenDeleted,
    }
