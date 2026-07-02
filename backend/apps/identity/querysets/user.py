from apps.identity.querysets.base import IdentityQuerySet


class UserQuerySet(IdentityQuerySet):

    def staff(self):
        return self.filter(is_staff=True)

    def superusers(self):
        return self.filter(is_superuser=True)

    def verified(self):
        return self.filter(email_verified=True)
