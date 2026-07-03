from apps.identity.authorization.resolver import AuthorizationResolver


class PermissionChecker:

    @classmethod
    def has_permission(
        cls,
        *,
        user,
        organization,
        permission,
    ):

        membership = AuthorizationResolver.resolve(
            user=user,
            organization=organization,
        )

        if membership is None:
            return False

        role = membership.role

        return role.permissions.filter(
            code=permission,
            is_active=True,
        ).exists()
