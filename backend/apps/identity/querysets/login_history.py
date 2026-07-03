from django.utils import timezone

from apps.identity.querysets.base import IdentityQuerySet


class LoginHistoryQuerySet(IdentityQuerySet):

    def successful(self):
        return self.filter(status="success")

    def failed(self):
        return self.filter(status="failed")

    def for_user(self, user):
        return self.filter(user=user)

    def for_organization(self, organization):
        return self.filter(organization=organization)

    def today(self):
        return self.filter(
            authenticated_at__date=timezone.now().date(),
        )

    def between(self, start, end):
        return self.filter(
            authenticated_at__range=(start, end),
        )

    def with_related(self):
        return self.select_related(
            "user",
            "organization",
            "session",
        )
