from apps.identity.models import UserMFA
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class UserMFASelector(IdentityBaseSelector):
    model = UserMFA

    @classmethod
    def get_by_user(cls, user):
        return UserMFA.objects.select_related_all().filter(user=user).first()

    @classmethod
    def get_enabled(cls):
        return UserMFA.objects.enabled().select_related_all()

    @classmethod
    def get_verified(cls):
        return UserMFA.objects.verified().select_related_all()

    @classmethod
    def get_by_method(cls, method):
        return UserMFA.objects.by_method(method).select_related_all()

    @classmethod
    def is_enabled(cls, user):
        return UserMFA.objects.enabled().filter(user=user).exists()

    @classmethod
    def is_verified(cls, user):
        return UserMFA.objects.verified().filter(user=user).exists()
