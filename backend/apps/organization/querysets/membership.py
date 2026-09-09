from django.db import models


class OrganizationMembershipQuerySet(models.QuerySet):
    def active(self):
        return self.filter(status="active")

    def on_leave(self):
        return self.filter(status="on_leave")

    def terminated(self):
        return self.filter(status="terminated")

    def suspended(self):
        return self.filter(status="suspended")

    def by_organization(self, organization):
        return self.filter(organization=organization)

    def by_user(self, user):
        return self.filter(user=user)

    def primary(self):
        return self.filter(is_primary=True)

    def with_user(self):
        return self.select_related("user")

    def with_organization(self):
        return self.select_related("organization")

    def with_department(self):
        return self.select_related("department")

    def with_team(self):
        return self.select_related("team")

    def with_office(self):
        return self.select_related("office")

    def with_role(self):
        return self.select_related("role")
