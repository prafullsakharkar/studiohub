from apps.core.models.querysets.base import BaseQuerySet


class OrganizationSettingsQuerySet(BaseQuerySet):

    def with_organization(self):
        return self.select_related("organization")

    def for_organization(self, organization):
        return self.filter(organization=organization)
