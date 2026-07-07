from django.utils import timezone

from apps.core.models import BaseQuerySet


class BackupCodeQuerySet(BaseQuerySet):
    def available(self):
        return self.filter(
            used=False,
        ).filter(
            expires_at__gt=timezone.now(),
        )

    def used(self):
        return self.filter(used=True)

    def expired(self):
        return self.filter(
            expires_at__lte=timezone.now(),
        )

    def by_user(self, user):
        return self.filter(user=user)

    def select_related_all(self):
        return self.select_related("user")
