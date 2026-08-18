from apps.core.events import DomainEvent


class IPBlacklistCreated(DomainEvent):
    event_type = "identity.ip_blacklist.created"


class IPBlacklistUpdated(DomainEvent):
    event_type = "identity.ip_blacklist.updated"


class IPBlacklistArchived(DomainEvent):
    event_type = "identity.ip_blacklist.archived"


class IPBlacklistActivated(DomainEvent):
    event_type = "identity.ip_blacklist.activated"


class IPBlacklistDeactivated(DomainEvent):
    event_type = "identity.ip_blacklist.deactivated"


class IPBlacklistRestored(DomainEvent):
    event_type = "identity.ip_blacklist.restored"


class IPBlacklistDeleted(DomainEvent):
    event_type = "identity.ip_blacklist.deleted"
