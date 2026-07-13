from apps.identity.choices import (
    MembershipStatus,
)
from apps.identity.models import (
    OrganizationMembership,
)
from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class MembershipValidator(
    IdentityBaseValidator,
):
    """
    Validator for OrganizationMembership.
    """

    model = OrganizationMembership

    @classmethod
    def validate_unique_membership(
        cls,
        *,
        user,
        organization,
        instance=None,
    ):
        queryset = OrganizationMembership.objects.filter(
            user=user,
            organization=organization,
        )

        if instance:
            queryset = queryset.exclude(
                pk=instance.pk,
            )

        if queryset.exists():
            raise ValueError(
                "User is already a member of this organization.",
            )

    @classmethod
    def validate_primary_membership(
        cls,
        *,
        user,
        organization,
        is_primary,
        instance=None,
    ):
        if not is_primary:
            return

        queryset = OrganizationMembership.objects.filter(
            user=user,
            organization=organization,
            is_primary=True,
        )

        if instance:
            queryset = queryset.exclude(
                pk=instance.pk,
            )

        if queryset.exists():
            raise ValueError(
                "Only one primary membership is allowed per organization.",
            )

    @classmethod
    def validate_leave_date(
        cls,
        *,
        joined_at,
        left_at,
    ):
        if joined_at and left_at and left_at < joined_at:
            raise ValueError(
                "Leave date cannot be before join date.",
            )

    @classmethod
    def validate_activate(
        cls,
        membership,
    ):
        if membership.status == MembershipStatus.ACTIVE:
            raise ValueError(
                "Membership is already active.",
            )

    @classmethod
    def validate_deactivate(
        cls,
        membership,
    ):
        if membership.status != MembershipStatus.ACTIVE:
            raise ValueError(
                "Only active memberships can be deactivated.",
            )

    @classmethod
    def validate_create(
        cls,
        data,
    ):
        cls.validate_unique_membership(
            user=data.get("user"),
            organization=data.get("organization"),
        )

        cls.validate_primary_membership(
            user=data.get("user"),
            organization=data.get("organization"),
            is_primary=data.get("is_primary", False),
        )

        cls.validate_leave_date(
            joined_at=data.get("joined_at"),
            left_at=data.get("left_at"),
        )

    @classmethod
    def validate_update(
        cls,
        instance,
        data,
    ):
        cls.validate_unique_membership(
            user=data.get("user", instance.user),
            organization=data.get(
                "organization",
                instance.organization,
            ),
            instance=instance,
        )

        cls.validate_primary_membership(
            user=data.get("user", instance.user),
            organization=data.get(
                "organization",
                instance.organization,
            ),
            is_primary=data.get(
                "is_primary",
                instance.is_primary,
            ),
            instance=instance,
        )

        cls.validate_leave_date(
            joined_at=data.get(
                "joined_at",
                instance.joined_at,
            ),
            left_at=data.get(
                "left_at",
                instance.left_at,
            ),
        )
