from apps.identity.querysets.base import (
    IdentityQuerySet,
)


class UserRoleQuerySet(
    IdentityQuerySet,
):

    def for_user(
        self,
        user,
    ):
        return self.filter(
            user=user,
        )

    def for_role(
        self,
        role,
    ):
        return self.filter(
            role=role,
        )
