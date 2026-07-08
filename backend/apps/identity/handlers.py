from apps.core.events.handlers import DomainEventHandler


class UserAuditHandler(DomainEventHandler): ...


class UserNotificationHandler(DomainEventHandler): ...


class UserMetricsHandler(DomainEventHandler): ...
