from apps.core.events import DomainEvent


class PersonalAccessTokenCreated(DomainEvent):
    event_type = "identity.personal_access_token.created"


class PersonalAccessTokenActivated(DomainEvent):
    event_type = "identity.personal_access_token.activated"


class PersonalAccessTokenRevoked(DomainEvent):
    event_type = "identity.personal_access_token.revoked"


class PersonalAccessTokenRegenerated(DomainEvent):
    event_type = "identity.personal_access_token.regenerated"


class PersonalAccessTokenUsed(DomainEvent):
    event_type = "identity.personal_access_token.used"


class PersonalAccessTokenExpired(DomainEvent):
    event_type = "identity.personal_access_token.expired"
