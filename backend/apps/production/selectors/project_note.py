"""
Reads of project notes (docs/review-pipeline RP-2, C-RP-08 to C-RP-10).

Every notes route needs whole-project access (``ProjectScopedAPIView`` with ``external_allowed``
off), so the caller sees every record of the project; the narrowing in ``scope_by_project_membership``
still applies to the notes themselves, as before.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any
from uuid import UUID

from django.db.models import Count, Prefetch, Q, QuerySet

from apps.production.models import ProjectNote, ProjectNoteLink, ProjectNoteMention
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.validators.project_note import link_model, record_code, record_name


def _links() -> Prefetch[Any]:
    return Prefetch("links", queryset=ProjectNoteLink.objects.order_by("position", "id"))


def mentions_prefetch() -> Prefetch[Any]:
    """A note's mentions with their people, in the order written (RP-6, C-RP-25)."""
    return Prefetch(
        "mentions",
        queryset=ProjectNoteMention.objects.select_related("user__profile").order_by(
            "position", "id"
        ),
    )


class ProjectNoteSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[ProjectNote]:
        return ProjectNote.objects.select_related("project", "author", "task").prefetch_related(
            _links(), mentions_prefetch()
        )

    @classmethod
    def threads(cls) -> QuerySet[ProjectNote]:
        """Notes that are not replies, with their live reply count (C-RP-09)."""
        return (
            ProjectNoteSelector.get_queryset()
            .filter(parent__isnull=True)
            .annotate(
                live_reply_count=Count(
                    "replies", filter=Q(replies__is_deleted=False), distinct=True
                )
            )
        )

    @classmethod
    def note_in_project(
        cls, *, project, note_id: Any, request
    ) -> tuple[ProjectNote, ProjectNote] | None:
        """
        ``(note, thread)`` for the live note ``note_id`` of ``project`` (``thread`` is the note itself,
        or a reply's root, with its reply count), if the caller can see the thread; else ``None``
        (the routes answer 404, also for a reply whose thread was deleted).
        """
        try:
            pk = UUID(str(note_id))
        except ValueError:
            return None
        note = cls.get_queryset().filter(project=project, pk=pk).first()
        if note is None:
            return None
        thread_id = note.parent_id or note.pk  # pyright: ignore[reportAttributeAccessIssue]
        thread = ProductionBaseSelector.scope_by_project_membership(
            cls.threads().filter(project=project, pk=thread_id), request=request
        ).first()
        if thread is None:
            return None
        return (thread if note.pk == thread.pk else note), thread

    @classmethod
    def link_labels(cls, links) -> dict[tuple[str, UUID], tuple[str, str]]:
        """
        Each linked record's code and name as they are now, one query per type. Archived records
        still answer, so a note keeps saying what it was about.
        """
        wanted: dict[str, set[UUID]] = defaultdict(set)
        for link in links:
            wanted[link.entity_type].add(link.entity_id)
        labels: dict[tuple[str, UUID], tuple[str, str]] = {}
        for entity_type, ids in wanted.items():
            model = link_model(entity_type)
            for row in model._base_manager.filter(pk__in=ids):
                labels[(entity_type, row.pk)] = (record_code(row), record_name(row))
        return labels


class ProjectNoteThreadSelector(ProjectNoteSelector):
    """The list route's rows: threads only (C-RP-09)."""

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[ProjectNote]:
        return ProjectNoteSelector.threads()
