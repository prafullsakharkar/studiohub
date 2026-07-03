from apps.organization.querysets.base import (
    OrganizationEntityQuerySet,
)


class BrandingQuerySet(
    OrganizationEntityQuerySet,
):
    """
    QuerySet for Branding.
    """

    def with_logo(self):
        return self.exclude(
            logo="",
        ).exclude(
            logo__isnull=True,
        )

    def with_theme(
        self,
        theme,
    ):
        return self.filter(
            theme=theme,
        )
