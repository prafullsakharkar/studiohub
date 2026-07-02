from django.db.models import QuerySet

from apps.organization.models.office import Office
from apps.organization.selectors.base import (
    OrganizationBaseSelector,
)


class OfficeSelector(OrganizationBaseSelector):
    """
    Read operations for Office.
    """

    model = Office

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        """
        Optimized queryset for Office APIs.
        """
        return cls.model.objects.select_related(
            "organization",
            "manager",
        )

    # ---------------------------------------------------------
    # Organization
    # ---------------------------------------------------------

    @classmethod
    def for_organization(cls, organization):
        return cls.get_queryset().filter(
            organization=organization,
        )

    # ---------------------------------------------------------
    # Head Office
    # ---------------------------------------------------------

    @classmethod
    def headquarters(cls):
        return cls.get_queryset().headquarters()

    # ---------------------------------------------------------
    # Location
    # ---------------------------------------------------------

    @classmethod
    def by_country(cls, country):
        return cls.get_queryset().by_country(country)

    @classmethod
    def by_state(cls, state):
        return cls.get_queryset().filter(
            state__iexact=state,
        )

    @classmethod
    def by_city(cls, city):
        return cls.get_queryset().by_city(city)

    @classmethod
    def by_timezone(cls, timezone):
        return cls.get_queryset().by_timezone(timezone)

    # ---------------------------------------------------------
    # Management
    # ---------------------------------------------------------

    @classmethod
    def by_manager(cls, user):
        return cls.get_queryset().by_manager(user)
