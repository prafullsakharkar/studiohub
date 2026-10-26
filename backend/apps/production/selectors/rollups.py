"""
Values derived from other records, read the same way everywhere (DECISIONS D-15, D-16).

* A task's hours: ``logged`` is the sum of its approved timelogs (corrections are
  approved entries too, possibly negative), ``pending`` the sum of its submitted ones.
  Drafts, rejected and soft-deleted entries count for neither.
* A shot's current version: its latest published version, else its latest version
  (archived versions, which are soft-deleted, never count). "Latest" is the most recently
  created, not the highest number: numbers are typed by clients.

``annotate`` adds both values to a queryset in the same query (lists); ``of`` reads them
from that annotation, or computes them for a single instance (create and update responses).
The stored ``Task.logged_hours`` and ``Shot.current_version`` columns are no longer read.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import DecimalField, OuterRef, Q, QuerySet, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from apps.production.models import Timelog, Version

ZERO = Decimal("0.00")
_HOURS = DecimalField(max_digits=10, decimal_places=2)


def hours_text(value: Decimal | None) -> str:
    """Two decimals as text, the form the stored ``DecimalField`` always had in responses."""
    return format((value or ZERO).quantize(ZERO), "f")


class TaskHoursSelector:
    LOGGED = "Approved"
    PENDING = "Submitted"

    @classmethod
    def _total(cls, status: str):
        return Coalesce(
            Subquery(
                Timelog.objects.filter(task=OuterRef("pk"), status=status)
                .order_by()
                .values("task")
                .annotate(total=Sum("duration_hours"))
                .values("total"),
                output_field=_HOURS,
            ),
            Value(ZERO),
            output_field=_HOURS,
        )

    @classmethod
    def annotate(cls, queryset: QuerySet[Any]) -> QuerySet[Any]:
        return queryset.annotate(
            logged_hours_annotated=cls._total(cls.LOGGED),
            pending_hours_annotated=cls._total(cls.PENDING),
        )

    @classmethod
    def of(cls, task: Any) -> tuple[Decimal, Decimal]:
        """``(logged, pending)`` for ``task``."""
        logged = getattr(task, "logged_hours_annotated", None)
        pending = getattr(task, "pending_hours_annotated", None)
        if logged is not None and pending is not None:
            return logged, pending
        if getattr(task, "pk", None) is None:
            return ZERO, ZERO
        totals = Timelog.objects.filter(task=task).aggregate(
            logged=Sum("duration_hours", filter=Q(status=cls.LOGGED)),
            pending=Sum("duration_hours", filter=Q(status=cls.PENDING)),
        )
        return totals["logged"] or ZERO, totals["pending"] or ZERO


class ShotCurrentVersionSelector:
    @classmethod
    def _latest(cls):
        # Published first, then newest: one ordering gives "latest published, else latest".
        return Version.objects.filter(shot=OuterRef("pk")).order_by(
            "-is_published", "-created_at", "-pk"
        )

    @classmethod
    def annotate(cls, queryset: QuerySet[Any]) -> QuerySet[Any]:
        return queryset.annotate(
            current_version_number_annotated=Coalesce(
                Subquery(cls._latest().values("version_number")[:1]), Value("")
            ),
            current_version_id_annotated=Subquery(cls._latest().values("id")[:1]),
        )

    @classmethod
    def of(cls, shot: Any) -> tuple[str, Any]:
        """``(version number or "", version id or None)`` for ``shot``."""
        if hasattr(shot, "current_version_number_annotated"):
            return shot.current_version_number_annotated, shot.current_version_id_annotated
        if getattr(shot, "pk", None) is None:
            return "", None
        row = (
            Version.objects.filter(shot=shot)
            .order_by("-is_published", "-created_at", "-pk")
            .values_list("version_number", "id")
            .first()
        )
        return row if row else ("", None)
