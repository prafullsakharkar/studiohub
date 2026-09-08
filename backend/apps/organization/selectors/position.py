
from apps.organization.models import Position
from apps.organization.querysets.position import PositionQuerySet

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
    ) -> PositionQuerySet:
        return Position.objects.select_related(
            "organization",
            "department",
            "parent",
        )
