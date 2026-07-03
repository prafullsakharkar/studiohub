from apps.organization.querysets.base import (
    OrganizationEntityQuerySet,
)


class HolidayQuerySet(
    OrganizationEntityQuerySet,
):

    def recurring(self):
        return self.filter(is_recurring=True)

    def paid(self):
        return self.filter(is_paid=True)

    def for_calendar(self, calendar):
        return self.filter(work_calendar=calendar)
