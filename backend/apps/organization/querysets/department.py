from .base import OrganizationEntityQuerySet


class DepartmentQuerySet(
    OrganizationEntityQuerySet,
):
    """
    Department specific queries.
    """

    def roots(self):
        return self.filter(parent__isnull=True)

    def leaves(self):
        return self.filter(children__isnull=True)
