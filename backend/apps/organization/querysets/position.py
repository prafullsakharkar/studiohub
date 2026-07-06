from apps.organization.querysets.base import (
    OrganizationEntityQuerySet,
)


class PositionQuerySet(
    OrganizationEntityQuerySet,
):

    def managerial(self):
        return self.filter(
            is_managerial=True,
        )

    def by_department(
        self,
        department,
    ):
        return self.filter(
            department=department,
        )
