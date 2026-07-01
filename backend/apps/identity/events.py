from apps.core.events import subscribe

from .domain_events import (
    UserCreatedEvent,
    UserUpdatedEvent,
)
from .handlers import (
    UserAuditHandler,
    UserMetricsHandler,
    UserNotificationHandler,
)


def register_events() -> None:
    subscribe(UserCreatedEvent, UserAuditHandler)
    subscribe(UserCreatedEvent, UserNotificationHandler)
    subscribe(UserUpdatedEvent, UserMetricsHandler)
