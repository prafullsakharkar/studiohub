from django.db import models

from apps.core.models import BaseQuerySet


class UserMFAQuerySet(BaseQuerySet):
    def enabled(self):
        return self.filter(enabled=True)

    def disabled(self):
        return self.filter(enabled=False)

    def verified(self):
        return self.filter(verified=True)

    def pending(self):
        return self.filter(verified=False)

    def active(self):
        return self.filter(status="active")

    def locked(self):
        return self.exclude(locked_until=None)

    def by_user(self, user):
        return self.filter(user=user)

    def by_method(self, method):
        return self.filter(method=method)

    def select_related_all(self):
        return self.select_related("user")
