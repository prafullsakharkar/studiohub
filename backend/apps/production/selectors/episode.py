from typing import Any
from uuid import UUID

from django.db.models import Q, QuerySet

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
        return Episode.objects.select_related("project").all()

    @classmethod
    def _code_for(cls, text: str) -> str:
        """Map a frontend mock id (``ep-101``) to its episode code; else the text."""
        return cls.FRONTEND_MOCK_ID_TO_CODE.get(text.lower(), text)

    @classmethod
    def resolve_in_project(cls, project, lookup: Any) -> Episode | None:
        """
        Resolve an episode inside ``project`` from a reference value.

        Accepts UUID pk, ``code`` (case-insensitive), or frontend
        mock-dataset id (``ep-101`` …). Codes repeat across projects (every
        episodic project is bootstrapped with ``EP101``), so the lookup is
        always constrained to ``project``: an episode of another project
        resolves to ``None`` exactly like an unknown one, without an
        existence leak. Soft-deleted episodes never resolve.
        """
        if project is None or lookup is None:
            return None
        base = cls.get_queryset().filter(project=project, is_deleted=False)
        if isinstance(lookup, Episode):
            return base.filter(pk=lookup.pk).first()
        text = str(lookup).strip()
        if not text:
            return None
        hit: Any = None
        try:
            hit = base.filter(id=text).first()
        except (ValueError, TypeError, Exception):
            hit = None
        if hit is not None:
            return hit
        return base.filter(code__iexact=cls._code_for(text)).first()

    @classmethod
    def lookup_q(cls, lookup: Any, *, prefix: str = "") -> Q:
        """
        Filter condition matching episodes by a reference value, for lists.

        Never resolves globally: the condition is applied to a queryset that
        is already narrowed (membership scope, optional ``project`` filter),
        so ``EP101`` matches the episode of each visible project. Soft-deleted
        episodes never match. An unusable value matches nothing.
        """
        text = str(lookup or "").strip()
        if not text:
            return Q(pk__in=[])
        by_code = Q(**{f"{prefix}code__iexact": cls._code_for(text)})
        try:
            by_id = Q(**{f"{prefix}id": UUID(text)})
        except ValueError:
            by_id = Q(pk__in=[])
        return (by_id | by_code) & Q(**{f"{prefix}is_deleted": False})
