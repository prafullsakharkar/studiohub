from django.db import models


class OrganizationMembershipManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().select_related(
            "user",
            "organization",
            "department",
            "team",
            "office",
            "role",
        )

    def active(self):
        return self.get_queryset().filter(status="active")

    def on_leave(self):
        return self.get_queryset().filter(status="on_leave")

    def terminated(self):
        return self.get_queryset().filter(status="terminated")

    def suspended(self):
        return self.get_queryset().filter(status="suspended")

    def by_organization(self, organization):
        return self.get_queryset().filter(organization=organization)

    def by_user(self, user):
        return self.get_queryset().filter(user=user)

    def primary(self):
        return self.get_queryset().filter(is_primary=True)
