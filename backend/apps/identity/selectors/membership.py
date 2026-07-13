from django.db.models import QuerySet

from apps.identity.models import (
    OrganizationMembership,
)
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class MembershipSelector(
    IdentityBaseSelector,
):
    """
    Read operations for OrganizationMembership.
    """

    model = OrganizationMembership

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return OrganizationMembership.objects.select_related(
            "user",
            "organization",
            "department",
            "team",
            "office",
            "role",
        )

    @classmethod
    def for_user(
        cls,
        user,
    ):
        return cls.filter(
            user=user,
        )

    @classmethod
    def for_organization(
        cls,
        organization,
    ):
        return cls.filter(
            organization=organization,
        )

    @classmethod
    def active(cls):
        return cls.filter(
            status="active",
        )

    @classmethod
    def primary(cls):
        return cls.filter(
            is_primary=True,
        )

    @classmethod
    def by_role(
        cls,
        role,
    ):
        return cls.filter(
            role=role,
        )

    @classmethod
    def by_department(
        cls,
        department,
    ):
        return cls.filter(
            department=department,
        )

    @classmethod
    def by_team(
        cls,
        team,
    ):
        return cls.filter(
            team=team,
        )

    @classmethod
    def by_office(
        cls,
        office,
    ):
        return cls.filter(
            office=office,
        )
