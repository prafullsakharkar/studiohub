from django.db.models import QuerySet

from apps.identity.models import LoginAttempt
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class LoginAttemptSelector(
    IdentityBaseSelector,
):

    model = LoginAttempt

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:

        return LoginAttempt.objects.select_related(
            "user",
        )

    @classmethod
    def recent_failures(
        cls,
        username,
        minutes=15,
    ):
        return cls.get_queryset().failed().for_username(username).recent(minutes)
