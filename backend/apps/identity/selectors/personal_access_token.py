from apps.identity.models import (
    PersonalAccessToken,
)
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class PersonalAccessTokenSelector(
    IdentityBaseSelector,
):
    model = PersonalAccessToken

    @classmethod
    def get_active(cls):
        return PersonalAccessToken.objects.active()

    @classmethod
    def get_by_prefix(
        cls,
        prefix,
    ):
        return (
            PersonalAccessToken.objects.active()
            .filter(
                prefix=prefix,
            )
            .first()
        )

    @classmethod
    def get_by_user(
        cls,
        user,
    ):
        return PersonalAccessToken.objects.active().filter(
            user=user,
        )

    @classmethod
    def get_expired(cls):
        return PersonalAccessToken.objects.expired()

    @classmethod
    def get_inactive(cls):
        return PersonalAccessToken.objects.inactive()
