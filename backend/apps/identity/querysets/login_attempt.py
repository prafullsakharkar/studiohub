from datetime import timedelta

from django.utils import timezone

from apps.identity.querysets.base import (
    IdentityQuerySet,
)


class LoginAttemptQuerySet(
    IdentityQuerySet,
):

    def successful(self):
        return self.filter(
            successful=True,
        )

    def failed(self):
        return self.filter(
            successful=False,
        )

    def for_username(
        self,
        username,
    ):
        return self.filter(
            username=username,
        )

    def recent(
        self,
        minutes=15,
    ):
        return self.filter(
            attempted_at__gte=timezone.now() - timedelta(minutes=minutes),
        )
