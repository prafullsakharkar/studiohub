from apps.core.services.business import BusinessService
from apps.organization.events import (
    APIKeyCreated,
    APIKeyDeleted,
    APIKeyUpdated,
)
from apps.organization.validators.api_key import APIKeyValidator


class APIKeyService(BusinessService):
    """
    Service for APIKey model.
    """

    model = None
    validator_class = APIKeyValidator

    event_map = {
        "create": APIKeyCreated,
        "update": APIKeyUpdated,
        "delete": APIKeyDeleted,
    }
