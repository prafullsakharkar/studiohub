from django.db.models import Q

from apps.core.models.querysets.base import BaseQuerySet


class UserQuerySet(BaseQuerySet):

    def active(self):
        return self.filter(is_active=True)

    def inactive(self):
        return self.filter(is_active=False)

    def staff(self):
        return self.filter(is_staff=True)

    def superusers(self):
        return self.filter(is_superuser=True)

    def verified(self):
        return self.filter(is_email_verified=True)

    def online(self):
        return self.exclude(last_seen=None)

    def search(self, value):

        return self.filter(Q(email__icontains=value) | Q(full_name__icontains=value))
