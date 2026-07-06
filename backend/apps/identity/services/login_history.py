from apps.core.services.business import BusinessService
from apps.identity.events import (
    LoginHistoryCreated,
    LoginHistoryDeleted,
)
from apps.identity.models import LoginHistory
from apps.identity.validators.login_history import (
    LoginHistoryValidator,
)


class LoginHistoryService(
    BusinessService,
):

    model = LoginHistory

    validator_class = LoginHistoryValidator

    event_map = {
        "create": LoginHistoryCreated,
        "delete": LoginHistoryDeleted,
    }
