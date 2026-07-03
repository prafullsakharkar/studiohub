from apps.organization.querysets.base import (
    OrganizationEntityQuerySet,
)


class WorkCalendarQuerySet(
    OrganizationEntityQuerySet,
):

    def default(self):
        return self.filter(
            is_default=True,
        )

    def with_timezone(
        self,
        timezone,
    ):
        return self.filter(
            timezone=timezone,
        )
