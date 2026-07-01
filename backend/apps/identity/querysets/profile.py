from django.db.models import Q

from apps.core.models.querysets.base import BaseQuerySet


class ProfileQuerySet(BaseQuerySet):

    def complete(self):
        return self.exclude(display_name="")

    def missing_avatar(self):
        return self.filter(Q(avatar__isnull=True) | Q(avatar=""))

    def by_language(self, language):
        return self.filter(language=language)

    def by_timezone(self, timezone):
        return self.filter(timezone=timezone)

    def search(self, value):
        return self.filter(
            Q(display_name__icontains=value)
            | Q(first_name__icontains=value)
            | Q(last_name__icontains=value)
        )
