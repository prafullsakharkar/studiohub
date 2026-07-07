from django.utils import timezone

from apps.core.models import BaseQuerySet


class UserMFAQuerySet(BaseQuerySet):

    def enabled(self):
        return self.filter(
            status="enabled",
        )

    def verified(self):
        return self.filter(
            is_verified=True,
        )

    def locked(self):
        return self.filter(
            locked_until__gt=timezone.now(),
        )

    def unlocked(self):
        return self.filter(
            models.Q(locked_until__isnull=True) | models.Q(locked_until__lte=timezone.now())
        )
