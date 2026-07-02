from apps.organization.querysets.base import (
    OrganizationEntityQuerySet,
)


class OfficeQuerySet(OrganizationEntityQuerySet):
    """
    Office specific QuerySet.
    """

    def headquarters(self):
        return self.filter(is_headquarters=True)

    def by_city(self, city: str):
        return self.filter(city__iexact=city)

    def by_country(self, country: str):
        return self.filter(country__iexact=country)

    def by_timezone(self, timezone: str):
        return self.filter(timezone=timezone)

    def by_manager(self, user):
        return self.filter(manager=user)
