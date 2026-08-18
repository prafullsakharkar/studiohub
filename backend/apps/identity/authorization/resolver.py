from apps.organization.models import (
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
            .with_user()
            .with_organization()
            .with_role()
            .filter(
                user=user,
                organization=organization,
            )
            .first()
        )
