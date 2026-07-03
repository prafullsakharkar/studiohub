from django.db.models import QuerySet

from apps.organization.models import Branding

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
    ) -> QuerySet:
        return Branding.objects.all()
