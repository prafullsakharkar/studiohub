"""
Blank the reasons of old, decided leave (decision Q37).

Leave reasons are private (D-20) and need not be kept forever. This clears ``reason`` and
``rejection_reason`` on Approved and Rejected leave that ended more than N years ago (default 3),
keeping the rows, the dates and who decided. Pending leave is never touched. It is a dry run unless
``--apply`` is given, and it prints counts only, never a reason. Run it by hand; nothing schedules
it.

    manage.py redact_leave_reasons [--older-than-years 3] [--apply]
"""

from __future__ import annotations

from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.scheduling.models import ResourceLeave
from apps.scheduling.services import audit

DEFAULT_YEARS = 3


def cutoff(years: int, today: date | None = None) -> date:
    """The date ``years`` years before ``today``; leave that ended before it is old enough."""
    today = today or timezone.now().date()
    try:
        return today.replace(year=today.year - years)
    except ValueError:  # 29 February
        return today.replace(year=today.year - years, day=28)


class Command(BaseCommand):
    help = "Blank the reasons of decided leave older than N years (dry run unless --apply)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--older-than-years",
            type=int,
            default=DEFAULT_YEARS,
            help=f"Leave that ended more than this many years ago (default {DEFAULT_YEARS}).",
        )
        parser.add_argument(
            "--apply", action="store_true", help="Make the change (default: only report)."
        )

    def handle(self, *args, **options):
        years = options["older_than_years"]
        if years < 1:
            raise CommandError("--older-than-years must be at least 1.")
        limit = cutoff(years)
        candidates = ResourceLeave.all_objects.filter(
            status__in=(ResourceLeave.STATUS_APPROVED, ResourceLeave.STATUS_REJECTED),
            end_date__lt=limit,
        ).filter(~Q(reason="") | ~Q(rejection_reason=""))
        count = candidates.count()
        if not options["apply"]:
            self.stdout.write(
                f"{count} decided leave rows that ended before {limit} still have a reason. "
                "Dry run: nothing was changed. Add --apply to blank them."
            )
            return
        candidates.update(reason="", rejection_reason="", updated_at=timezone.now())
        audit.record(
            actor=None,
            action=AuditLog.ACTION_UPDATE,
            target_id="redact_leave_reasons",
            target_name="Leave reasons redacted",
            description=f"Reasons of {count} decided leave rows that ended before {limit} blanked",
            metadata={"event": "leave.reasons_redacted", "count": count, "before": str(limit)},
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Blanked the reasons of {count} leave rows that ended before {limit}."
            )
        )
