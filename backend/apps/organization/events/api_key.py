from apps.core.events import DomainEvent


class APIKeyCreated(DomainEvent):
    event_type = "organization.api_key.created"


class APIKeyUpdated(DomainEvent):
    event_type = "organization.api_key.updated"


class APIKeyDeleted(DomainEvent):
    event_type = "organization.api_key.deleted"


class APIKeyRevoked(DomainEvent):
    event_type = "organization.api_key.revoked"


class APIKeyExpired(DomainEvent):
    event_type = "organization.api_key.expired"


class APIKeyUsed(DomainEvent):
    event_type = "organization.api_key.used"
