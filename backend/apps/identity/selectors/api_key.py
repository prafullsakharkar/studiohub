from apps.identity.models import APIKey
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class APIKeySelector(IdentityBaseSelector):
    model = APIKey

    @classmethod
    def get_active(cls):
        return APIKey.objects.active()

    @classmethod
    def get_valid(cls):
        return APIKey.objects.valid()

    @classmethod
    def get_by_prefix(cls, prefix):
        return APIKey.objects.valid().with_prefix(prefix).first()

    @classmethod
    def get_by_hashed_key(cls, hashed_key):
        return APIKey.objects.filter(
            hashed_key=hashed_key,
        ).first()

    @classmethod
    def get_by_organization(cls, organization):
        return APIKey.objects.valid().for_organization(
            organization,
        )

    @classmethod
    def get_by_user(cls, user):
        return APIKey.objects.valid().for_user(user)

    @classmethod
    def get_with_scope(cls, scope):
        return APIKey.objects.valid().with_scope(scope)
