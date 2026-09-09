from apps.core.events import DomainEvent


class ClientContractCreated(DomainEvent):
    event_type = "organization.client_contract.created"


class ClientContractUpdated(DomainEvent):
    event_type = "organization.client_contract.updated"


class ClientContractDeleted(DomainEvent):
    event_type = "organization.client_contract.deleted"


class ClientContractRestored(DomainEvent):
    event_type = "organization.client_contract.restored"


class VendorContractCreated(DomainEvent):
    event_type = "organization.vendor_contract.created"


class VendorContractUpdated(DomainEvent):
    event_type = "organization.vendor_contract.updated"


class VendorContractDeleted(DomainEvent):
    event_type = "organization.vendor_contract.deleted"


class VendorContractRestored(DomainEvent):
    event_type = "organization.vendor_contract.restored"
