from apps.identity.models import PersonalAccessToken
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class PersonalAccessTokenSelector(IdentityBaseSelector):
    model = PersonalAccessToken

    @classmethod
    def get_active(cls):
        return PersonalAccessToken.objects.active()

    @classmethod
    def get_valid(cls):
        return PersonalAccessToken.objects.valid()

    @classmethod
    def get_by_prefix(cls, prefix):
        return PersonalAccessToken.objects.valid().with_prefix(prefix).first()

    @classmethod
    def get_by_hashed_token(cls, hashed_token):
        return PersonalAccessToken.objects.filter(
            hashed_token=hashed_token,
        ).first()

    @classmethod
    def get_by_user(cls, user):
        return PersonalAccessToken.objects.valid().for_user(
            user,
        )

    @classmethod
    def get_with_scope(cls, scope):
        return PersonalAccessToken.objects.valid().with_scope(scope)
