from apps.organization.querysets.base import (
    OrganizationEntityQuerySet,
)


class CalendarQuerySet(
    OrganizationEntityQuerySet,
):

    def default(self):
        return self.filter(
            is_default=True,
        )

    def public(self):
        return self.filter(
            is_public=True,
        )
