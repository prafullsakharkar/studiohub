from apps.identity.querysets.base import (
    IdentityQuerySet,
)


class GroupMemberQuerySet(
    IdentityQuerySet,
):

    def for_group(self, group):
        return self.filter(group=group)

    def for_user(self, user):
        return self.filter(user=user)

    def owners(self):
        return self.filter(is_owner=True)

    def managers(self):
        return self.filter(is_manager=True)
