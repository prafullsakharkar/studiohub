from apps.core.services.business import BusinessService
from apps.organization.events import (
    OrganizationSettingsActivated,
    OrganizationSettingsArchived,
    OrganizationSettingsCreated,
    OrganizationSettingsDeactivated,
    OrganizationSettingsDeleted,
    OrganizationSettingsRestored,
    OrganizationSettingsUpdated,
)
from apps.organization.models import (
    OrganizationSettings,
)
from apps.organization.validators.organization_settings import (
    OrganizationSettingsValidator,
)


class OrganizationSettingsService(BusinessService):
    """
    Organization settings write service.
    """

    model = OrganizationSettings

    validator_class = OrganizationSettingsValidator

    event_map = {
        "create": OrganizationSettingsCreated,
        "update": OrganizationSettingsUpdated,
        "delete": OrganizationSettingsDeleted,
        "restore": OrganizationSettingsRestored,
        "archive": OrganizationSettingsArchived,
        "activate": OrganizationSettingsActivated,
        "deactivate": OrganizationSettingsDeactivated,
    }
