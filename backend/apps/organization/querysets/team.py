from .base import OrganizationEntityQuerySet


class TeamQuerySet(
    OrganizationEntityQuerySet,
):

    def by_department(self, department):
        return self.filter(
            department=department,
        )

    def by_lead(self, user):
        return self.filter(
            lead=user,
        )
