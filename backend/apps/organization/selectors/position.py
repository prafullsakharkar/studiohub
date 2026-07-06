from django.db.models import QuerySet

from apps.organization.models import Position

from .base import OrganizationBaseSelector


class PositionSelector(
    OrganizationBaseSelector,
):

    model = Position

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return Position.objects.select_related(
            "organization",
            "department",
            "parent",
        )
