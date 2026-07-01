from apps.identity.models.role_permission import RolePermission


class RolePermissionService:

    @staticmethod
    def grant(
        role,
        permission,
        user=None,
    ):

        return RolePermission.objects.grant(
            role,
            permission,
            user,
        )

    @staticmethod
    def revoke(
        role_permission,
    ):

        role_permission.granted = False

        role_permission.save()

        return role_permission
