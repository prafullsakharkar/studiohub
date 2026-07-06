from apps.organization.querysets.base import (
    OrganizationEntityQuerySet,
)


class WorkHoursQuerySet(
    OrganizationEntityQuerySet,
):

    def working_days(self):
        return self.filter(
            is_working_day=True,
        )

    def for_calendar(
        self,
        calendar,
    ):
        return self.filter(
            work_calendar=calendar,
        )

    def for_day(
        self,
        day,
    ):
        return self.filter(
            day=day,
        )
