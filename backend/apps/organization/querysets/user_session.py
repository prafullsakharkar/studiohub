from __future__ import annotations

from apps.organization.querysets.base import (
    OrganizationEntityQuerySet,
)


class UserSessionQuerySet(OrganizationEntityQuerySet):
    """
    QuerySet for UserSession model.
    """

    def active(self):
        return self.filter(status="active")

    def expired(self):
        from django.utils import timezone
        return self.filter(expires_at__lt=timezone.now())

    def logged_out(self):
        return self.filter(status="logged_out")

    def by_user(self, user):
        return self.filter(user=user)

    def by_organization(self, organization):
        return self.filter(organization=organization)

    def by_department(self, department):
        return self.filter(department=department)

    def by_team(self, team):
        return self.filter(team=team)

    def by_status(self, status):
        return self.filter(status=status)

    def current(self):
        return self.filter(is_current=True)

    def trusted(self):
        return self.filter(is_trusted=True)

    def untrusted(self):
        return self.filter(is_trusted=False)
