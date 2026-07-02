from apps.identity.querysets.base import IdentityQuerySet


class RolePermissionQuerySet(IdentityQuerySet):

    def for_role(self, role):
        return self.filter(role=role)

    def for_permission(self, permission):
        return self.filter(permission=permission)

    def with_related(self):
        return self.select_related(
            "role",
            "permission",
        )
