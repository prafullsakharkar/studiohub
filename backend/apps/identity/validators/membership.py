from django.core.exceptions import ValidationError

from apps.identity.models import OrganizationMembership


class MembershipValidator:

    @staticmethod
    def validate_primary_membership(
        user,
        organization,
        is_primary,
    ):
        """
        Only one primary membership is allowed.
        """

        if not is_primary:
            return

        exists = (
            OrganizationMembership.objects.filter(
                user=user,
                is_primary=True,
            )
            .exclude(
                organization=organization,
            )
            .exists()
        )

        if exists:
            raise ValidationError("User already has a primary membership.")

    @staticmethod
    def validate_role(role):
        if not role.is_assignable:
            raise ValidationError("Role cannot be assigned.")
