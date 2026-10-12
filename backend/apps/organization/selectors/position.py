
from django.db.models import Count, Q

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
        # Headcount is consumed per-row by PositionListSerializer; annotate
        # once here so list responses never N+1 over ``persons``.
        return (
            Position.objects.active()
            .select_related(
                "organization",
                "department",
                "parent",
            )
            .annotate(
                headcount_value=Count(
                    "persons", filter=Q(persons__is_deleted=False)
                )
            )
        )
