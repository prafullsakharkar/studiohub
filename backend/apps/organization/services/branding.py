from apps.core.services.business import BusinessService
from apps.organization.events import (
    BrandingActivated,
    BrandingArchived,
    BrandingCreated,
    BrandingDeactivated,
    BrandingDeleted,
    BrandingRestored,
    BrandingUpdated,
)
from apps.organization.models import Branding
from apps.organization.validators.branding import (
    BrandingValidator,
)


class BrandingService(BusinessService):
    """
    Branding write service.
    """

    model = Branding

    validator_class = BrandingValidator

    event_map = {
        "create": BrandingCreated,
        "update": BrandingUpdated,
        "delete": BrandingDeleted,
        "restore": BrandingRestored,
        "archive": BrandingArchived,
        "activate": BrandingActivated,
        "deactivate": BrandingDeactivated,
    }
