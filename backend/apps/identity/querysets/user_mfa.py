
from apps.identity.choices.mfa import MFAStatus
from apps.identity.querysets.base import IdentityQuerySet


class UserMFAQuerySet(IdentityQuerySet):
    def enabled(self):
        return self.filter(status=MFAStatus.ENABLED)

    def disabled(self):
        return self.filter(status=MFAStatus.DISABLED)

    def verified(self):
        return self.filter(is_verified=True)

    def pending(self):
        return self.filter(is_verified=False)

    def active(self):
        return self.filter(status=MFAStatus.ENABLED)

    def locked(self):
        return self.exclude(locked_until=None)

    def by_user(self, user):
        return self.filter(user=user)

    def by_method(self, method):
        return self.filter(primary_method=method)

    def select_related_all(self):
        return self.select_related("user")
