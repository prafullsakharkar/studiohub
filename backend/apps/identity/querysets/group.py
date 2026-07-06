from apps.identity.querysets.base import (
    IdentityQuerySet,
)


class GroupQuerySet(
    IdentityQuerySet,
):

    def active(self):
        return super().active()

    def system(self):
        return self.filter(
            is_system=True,
        )

    def custom(self):
        return self.filter(
            is_system=False,
        )

    def by_name(
        self,
        name,
    ):
        return self.filter(
            name__icontains=name,
        )

    def by_code(
        self,
        code,
    ):
        return self.filter(
            code=code,
        )
