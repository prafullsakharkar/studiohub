
from apps.identity.models import LoginAttempt
from apps.identity.querysets import LoginAttemptQuerySet
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
    ) -> LoginAttemptQuerySet:

        return LoginAttempt.objects.get_queryset().select_related(
            "user",
        )

    @classmethod
    def recent_failures(
        cls,
        username,
        minutes=15,
    ):
        return cls.get_queryset().failed().for_username(username).recent(minutes)

    @classmethod
    def failed_attempts(
        cls,
        username,
        ip_address,
    ):
        return (
            cls.get_queryset()
            .failed()
            .filter(
                username=username,
                ip_address=ip_address,
            )
        )
