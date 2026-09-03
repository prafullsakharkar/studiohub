from __future__ import annotations

from apps.organization.querysets.base import (
    OrganizationEntityQuerySet,
)


class UserPreferenceQuerySet(OrganizationEntityQuerySet):
    """
    QuerySet for UserPreference model.
    """

    def by_user(self, user):
        return self.filter(user=user)
