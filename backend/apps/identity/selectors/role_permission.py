from apps.identity.models.role_permission import RolePermission


class RolePermissionSelector:

    @staticmethod
    def permissions(role):

        return (
            RolePermission.objects.active()
            .by_role(role)
            .select_related(
                "permission",
            )
        )
