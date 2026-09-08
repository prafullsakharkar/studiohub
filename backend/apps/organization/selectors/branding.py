
from apps.organization.models import Branding
from apps.organization.querysets.branding import BrandingQuerySet

from .base import OrganizationBaseSelector


class BrandingSelector(
    OrganizationBaseSelector,
):
    """
    Read operations for Branding.
    """

    model = Branding

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> BrandingQuerySet:
        return Branding.objects.all()
