from django.db.models import QuerySet

from apps.identity.models import OrganizationMembership
from apps.identity.selectors.base import IdentityBaseSelector


class MembershipSelector(IdentityBaseSelector):
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
        return cls.model.objects.with_related()

    @classmethod
    def for_user(cls, user):
        return cls.get_queryset().for_user(user)

    @classmethod
    def for_organization(cls, organization):
        return cls.get_queryset().for_organization(organization)

    @classmethod
    def primary(cls):
        return cls.get_queryset().primary()

    @classmethod
    def active(cls):
        return cls.get_queryset().active()
