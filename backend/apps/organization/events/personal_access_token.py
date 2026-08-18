from apps.core.events import DomainEvent


class PersonalAccessTokenCreated(DomainEvent):
    event_type = "organization.personal_access_token.created"


class PersonalAccessTokenUpdated(DomainEvent):
    event_type = "organization.personal_access_token.updated"


class PersonalAccessTokenDeleted(DomainEvent):
    event_type = "organization.personal_access_token.deleted"


class PersonalAccessTokenRevoked(DomainEvent):
    event_type = "organization.personal_access_token.revoked"


class PersonalAccessTokenExpired(DomainEvent):
    event_type = "organization.personal_access_token.expired"


class PersonalAccessTokenUsed(DomainEvent):
    event_type = "organization.personal_access_token.used"
