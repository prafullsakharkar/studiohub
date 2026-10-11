from apps.organization.querysets.base import (
    OrganizationEntityQuerySet,
)


class CalendarEventQuerySet(
    OrganizationEntityQuerySet,
):

    def upcoming(self):
        from django.utils import timezone

        return self.filter(date__gte=timezone.localdate())

    def by_type(self, event_type):
        return self.filter(event_type=event_type)
