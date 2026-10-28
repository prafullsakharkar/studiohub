"""
List leave whose stored day count differs from its working-day count.

Before work calendars a leave was counted in calendar days (weekends and holidays included); new
requests count the working days of the calendar the resource follows (decision Q20). Old rows are
not recomputed: their counts stay as they were approved. This command only reports which rows would
come out differently, so someone can decide whether any needs attention. It changes nothing and
prints no reasons.

    manage.py report_leave_days [--status Approved] [--limit 200]
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.scheduling.models import ResourceLeave
from apps.scheduling.services.leave import working_leave_days


class Command(BaseCommand):
    help = "Report leave whose stored day count differs from its working days (read-only)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--status",
            choices=[value for value, _ in ResourceLeave.STATUS_CHOICES],
            help="Only leave with this status (default: all).",
        )
        parser.add_argument(
            "--limit", type=int, default=200, help="Most rows to list (default 200)."
        )

    def handle(self, *args, **options):
        leaves = ResourceLeave.objects.select_related("resource", "resource__calendar").order_by(
            "start_date", "id"
        )
        if options["status"]:
            leaves = leaves.filter(status=options["status"])

        checked = differing = 0
        for leave in leaves.iterator():
            checked += 1
            working = working_leave_days(leave.resource, leave.start_date, leave.end_date)
            if working == leave.total_days:
                continue
            differing += 1
            if differing <= options["limit"]:
                self.stdout.write(
                    f"{leave.id}  {leave.resource.code}  {leave.status}  "
                    f"{leave.start_date}..{leave.end_date}  stored={leave.total_days}  "
                    f"working={working}"
                )
        if differing > options["limit"]:
            self.stdout.write(f"... and {differing - options['limit']} more not listed")
        self.stdout.write(
            self.style.SUCCESS(
                f"{differing} of {checked} leave rows would count differently in working days. "
                "Nothing was changed."
            )
        )
