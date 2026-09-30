from typing import Any

from django.db.models import QuerySet

from apps.production.models import Episode
from apps.production.selectors.base import ProductionBaseSelector


class EpisodeSelector(ProductionBaseSelector):
    # Frontend-contract compat: studiohub-react mock dataset episode ids
    # (`src/mocks/db/production.ts`) are stable strings (`ep-101` …) while the
    # backend PK is a UUID. Mirrors `ProjectSelector.FRONTEND_MOCK_ID_TO_CODE`.
    FRONTEND_MOCK_ID_TO_CODE: dict[str, str] = {
        "ep-101": "EP101",
        "ep-102": "EP102",
        "ep-103": "EP103",
    }

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Episode]:
        return Episode.objects.select_related("organization", "project").all()

    @classmethod
    def resolve_by_lookup(cls, organization, lookup: Any) -> Episode | None:
        """
        Resolve an episode within ``organization`` from a reference value.

        Accepts UUID pk, ``code`` (case-insensitive), or frontend
        mock-dataset id (``ep-101`` …). Returns ``None`` when unresolvable;
        callers turn that into an empty result (filters) or a 400 (writes),
        never an existence leak across tenants. Soft-deleted episodes never
        resolve. Project membership of the episode is NOT checked here —
        chain validators compare ``episode.project_id`` themselves.
        """
        if lookup is None:
            return None
        if isinstance(lookup, Episode):
            return lookup if not lookup.is_deleted else None
        text = str(lookup).strip()
        if not text:
            return None
        base = cls.get_queryset().filter(is_deleted=False)
        if organization is not None:
            base = base.filter(organization=organization)
        hit: Any = None
        try:
            hit = base.filter(id=text).first()
        except (ValueError, TypeError, Exception):
            hit = None
        if hit is not None:
            return hit
        hit = base.filter(code__iexact=text).first()
        if hit is not None:
            return hit
        code = cls.FRONTEND_MOCK_ID_TO_CODE.get(text.lower())
        if code:
            hit = base.filter(code__iexact=code).first()
            if hit is not None:
                return hit
        return None
