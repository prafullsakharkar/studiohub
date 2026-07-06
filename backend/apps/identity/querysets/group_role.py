from apps.identity.querysets.base import (
    IdentityQuerySet,
)


class GroupRoleQuerySet(
    IdentityQuerySet,
):

    def for_group(
        self,
        group,
    ):
        return self.filter(
            group=group,
        )

    def for_role(
        self,
        role,
    ):
        return self.filter(
            role=role,
        )
