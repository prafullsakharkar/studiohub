from apps.identity.querysets.base import IdentityQuerySet


class UserQuerySet(IdentityQuerySet):

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

    def with_last_seen(self):
        return self.filter(last_seen__isnull=False)

    def get_by_id(self, id):
        return self.filter(pk=id).first()

    def get_by_email(self, email):
        return self.filter(email=email).first()

    def by_email(self, email):
        return self.filter(email__iexact=email)

    def by_username(self, username):
        # Usernames are the user's email address in this system.
        return self.filter(email__iexact=username)

    def get_by_username(self, username):
        return self.by_username(username).first()

    def lookup(self, value):
        """Match a user by email address or username."""
        return self.filter(email__iexact=value)

    def recent(self):
        """Users active recently (have a last_seen timestamp)."""
        return self.filter(last_seen__isnull=False).order_by("-last_seen")

    def order_by_last_seen(self):
        return self.order_by("-last_seen")

    def list_users(self, limit=None, offset=None, search=None, order_by=None):
        queryset = self.all()

        if search:
            queryset = queryset.filter(email__icontains=search)

        if order_by:
            queryset = queryset.order_by(order_by)

        if offset:
            queryset = queryset[offset:]

        if limit:
            queryset = queryset[:limit]

        return queryset

    def count_users(self):
        return self.count()

    def get_user_with_profile(self, id):
        return self.filter(pk=id).select_related("profile").first()

    def get_user_with_last_login(self, id):
        return self.filter(pk=id).first()
