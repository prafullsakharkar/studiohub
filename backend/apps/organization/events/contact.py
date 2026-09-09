from apps.core.events import DomainEvent


class ClientContactCreated(DomainEvent):
    event_type = "organization.client_contact.created"


class ClientContactUpdated(DomainEvent):
    event_type = "organization.client_contact.updated"


class ClientContactDeleted(DomainEvent):
    event_type = "organization.client_contact.deleted"


class ClientContactRestored(DomainEvent):
    event_type = "organization.client_contact.restored"


class VendorContactCreated(DomainEvent):
    event_type = "organization.vendor_contact.created"


class VendorContactUpdated(DomainEvent):
    event_type = "organization.vendor_contact.updated"


class VendorContactDeleted(DomainEvent):
    event_type = "organization.vendor_contact.deleted"


class VendorContactRestored(DomainEvent):
    event_type = "organization.vendor_contact.restored"
