from apps.core.services.business import (
    BusinessService,
)
from apps.identity.events import (
    MembershipActivated,
    MembershipArchived,
    MembershipCreated,
    MembershipDeactivated,
    MembershipDeleted,
    MembershipRestored,
    MembershipUpdated,
)
from apps.identity.models import (
    OrganizationMembership,
)
from apps.identity.validators.membership import (
    MembershipValidator,
)


class MembershipService(
    BusinessService,
):
    """
    Write operations for OrganizationMembership.
    """

    model = OrganizationMembership

    validator_class = MembershipValidator

    event_map = {
        "create": MembershipCreated,
        "update": MembershipUpdated,
        "delete": MembershipDeleted,
        "restore": MembershipRestored,
        "archive": MembershipArchived,
        "activate": MembershipActivated,
        "deactivate": MembershipDeactivated,
    }
