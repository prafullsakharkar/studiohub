from apps.identity.querysets.base import IdentityQuerySet


class MembershipQuerySet(IdentityQuerySet):

    def active(self):
        return self.filter(status="active")

    def for_user(self, user):
        return self.filter(user=user)

    def for_organization(self, organization):
        return self.filter(
            organization=organization,
        )

    def primary(self):
        return self.filter(
            is_primary=True,
        )

    def with_related(self):
        return self.select_related(
            "user",
            "organization",
            "department",
            "team",
            "office",
            "role",
        )
