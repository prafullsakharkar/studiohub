from typing import Any

from django.db.models import QuerySet

from apps.production.models import Sequence
from apps.production.selectors.base import ProductionBaseSelector


class SequenceSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Sequence]:
        return Sequence.objects.select_related("organization", "project").all()

    @classmethod
    def resolve_in_project(cls, project, lookup: Any) -> Sequence | None:
        """
        Resolve a sequence inside ``project`` from a reference value.

        Accepts UUID pk or ``code`` (case-insensitive). Project scoping is
        part of the chain-integrity contract: a sequence from another project
        resolves to ``None`` here so write validators can 400 without an
        existence leak. Soft-deleted sequences never resolve.
        """
        if project is None or lookup is None:
            return None
        if isinstance(lookup, Sequence):
            if lookup.is_deleted or lookup.project_id != project.id:
                return None
            return lookup
        text = str(lookup).strip()
        if not text:
            return None
        base = cls.get_queryset().filter(project=project, is_deleted=False)
        hit: Any = None
        try:
            hit = base.filter(id=text).first()
        except (ValueError, TypeError, Exception):
            hit = None
        if hit is not None:
            return hit
        return base.filter(code__iexact=text).first()
