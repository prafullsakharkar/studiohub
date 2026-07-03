from apps.identity.models import (
    OrganizationMembership,
)


class AuthorizationResolver:
    """
    Resolve user's active membership.
    """

    @staticmethod
    def resolve(
        *,
        user,
        organization,
    ):

        return (
            OrganizationMembership.objects.active()
            .with_related()
            .filter(
                user=user,
                organization=organization,
            )
            .first()
        )
