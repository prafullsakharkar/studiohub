from apps.identity.models import APIKey
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class APIKeySelector(
    IdentityBaseSelector,
):
    model = APIKey

    @classmethod
    def get_active(cls):
        return APIKey.objects.active()

    @classmethod
    def get_by_prefix(
        cls,
        prefix,
    ):
        return (
            APIKey.objects.active()
            .filter(
                prefix=prefix,
            )
            .first()
        )

    @classmethod
    def get_by_organization(
        cls,
        organization,
    ):
        return APIKey.objects.active().filter(
            organization=organization,
        )

    @classmethod
    def get_expired(cls):
        return APIKey.objects.expired()

    @classmethod
    def get_inactive(cls):
        return APIKey.objects.inactive()
