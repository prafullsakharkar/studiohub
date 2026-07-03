from dataclasses import dataclass

from apps.identity.models import (
    OrganizationMembership,
    User,
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
