from apps.core.events import DomainEvent


class PersonalAccessTokenCreated(DomainEvent):
    event_name = "identity.personal_access_token.created"


class PersonalAccessTokenActivated(DomainEvent):
    event_name = "identity.personal_access_token.activated"


class PersonalAccessTokenRevoked(DomainEvent):
    event_name = "identity.personal_access_token.revoked"


class PersonalAccessTokenRegenerated(DomainEvent):
    event_name = "identity.personal_access_token.regenerated"


class PersonalAccessTokenUsed(DomainEvent):
    event_name = "identity.personal_access_token.used"


class PersonalAccessTokenExpired(DomainEvent):
    event_name = "identity.personal_access_token.expired"
