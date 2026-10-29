from django.db.models import Prefetch, QuerySet

from apps.production.models import Review, ReviewComment
from apps.production.selectors.base import ProductionBaseSelector


class ReviewSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Review]:
        return (
            Review.objects.select_related("project", "lead_reviewer")
            .prefetch_related(
                "items__version",
                "participants__user",
                Prefetch(
                    "comment_rows",
                    queryset=ReviewComment.objects.prefetch_related("replies"),
                ),
                "note_rows",
                "annotation_rows",
                "activity_rows",
            )
            .all()
        )
