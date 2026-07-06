from apps.core.services.business import BusinessService
from apps.organization.events import (
    PositionActivated,
    PositionArchived,
    PositionCreated,
    PositionDeactivated,
    PositionDeleted,
    PositionRestored,
    PositionUpdated,
)
from apps.organization.models import Position
from apps.organization.validators.position import PositionValidator


class PositionService(
    BusinessService,
):

    model = Position

    validator_class = PositionValidator

    event_map = {
        "create": PositionCreated,
        "update": PositionUpdated,
        "delete": PositionDeleted,
        "restore": PositionRestored,
        "archive": PositionArchived,
        "activate": PositionActivated,
        "deactivate": PositionDeactivated,
    }
