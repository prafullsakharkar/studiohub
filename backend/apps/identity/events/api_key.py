from apps.core.events import DomainEvent


class APIKeyCreated(DomainEvent):
    event_name = "identity.api_key.created"


class APIKeyActivated(DomainEvent):
    event_name = "identity.api_key.activated"


class APIKeyRevoked(DomainEvent):
    event_name = "identity.api_key.revoked"


class APIKeyRegenerated(DomainEvent):
    event_name = "identity.api_key.regenerated"


class APIKeyUsed(DomainEvent):
    event_name = "identity.api_key.used"


class APIKeyExpired(DomainEvent):
    event_name = "identity.api_key.expired"
