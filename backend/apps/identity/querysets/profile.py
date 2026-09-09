from django.db.models import Q

from apps.identity.querysets.base import IdentityQuerySet


class ProfileQuerySet(IdentityQuerySet):

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

    def lookup(self, value):
        return self.filter(
            Q(display_name__icontains=value)
            | Q(first_name__icontains=value)
            | Q(last_name__icontains=value)
        )

    def with_user(self):
        return self.select_related("user")

    def by_user(self, user):
        return self.filter(user=user)

    def order_by_name(self):
        return self.order_by("first_name", "last_name")

    # ------------------------------------------------------------------
    # Selector-style helpers
    # ------------------------------------------------------------------

    def get_profile_by_user(self, user_id):
        return self.filter(user_id=user_id).first()

    def list_profiles(
        self,
        limit=None,
        offset=None,
        search=None,
        order_by=None,
    ):
        queryset = self.all()

        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(display_name__icontains=search)
            )

        if order_by:
            queryset = queryset.order_by(order_by)

        if offset:
            queryset = queryset[offset:]

        if limit:
            queryset = queryset[:limit]

        return queryset

    def count_profiles(self):
        return self.count()

    def get_profile_with_user(self, id):
        return (
            self.filter(pk=id)
            .select_related("user")
            .first()
        )
