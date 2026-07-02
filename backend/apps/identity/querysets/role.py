from apps.identity.querysets.base import IdentityQuerySet


class RoleQuerySet(IdentityQuerySet):
    """
    QuerySet for Role model.
    """

    def for_organization(self, organization):
        return self.filter(
            organization=organization,
        )

    def system(self):
        return self.filter(
            is_system=True,
        )

    def custom(self):
        return self.filter(
            is_system=False,
        )

    def default(self):
        return self.filter(
            is_default=True,
        )

    def assignable(self):
        return self.filter(
            is_assignable=True,
        )

    def ordered(self):
        return self.order_by(
            "priority",
            "name",
        )

    def with_permissions(self):
        return self.prefetch_related(
            "permissions",
        )
