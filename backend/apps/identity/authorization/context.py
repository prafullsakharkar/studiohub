from dataclasses import dataclass

from apps.identity.models import User
from apps.organization.models import (
    OrganizationMembership,
)


@dataclass(slots=True)
class AuthorizationContext:
    """
    Context used during permission evaluation.
    """

    user: User

    membership: OrganizationMembership | None

    organization = None

    department = None

    team = None

    office = None
