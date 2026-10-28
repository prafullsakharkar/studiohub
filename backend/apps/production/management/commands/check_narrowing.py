"""
Report memberships whose show or department narrowing is likely misconfigured (TPN review TM-002).

A membership narrowed by show or department sees only the records that match. If nothing matches, the
member sees an empty project, which is safe but is usually a data problem: records not yet assigned to
the show, or a department written differently on the membership and on the tasks.

    manage.py check_narrowing [--project CODE]

Read-only. Exit status 1 if any membership is flagged, so it can gate a deployment.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.production.models import Asset, Episode, ProjectMembership, Sequence, Shot, Task
from apps.production.selectors import internal_scope

UNASSIGNED = (("episodes", Episode), ("sequences", Sequence), ("shots", Shot), ("assets", Asset))


class Command(BaseCommand):
    help = "Flag show- or department-narrowed memberships that match no records."

    def add_arguments(self, parser):
        parser.add_argument("--project", help="Limit to one project code.")

    def handle(self, *args, **options):
        memberships = ProjectMembership.objects.filter(
            is_deleted=False, status__iexact="active", vendor_id="", client_id=""
        ).select_related("project", "user")

        if options["project"]:
            memberships = memberships.filter(project__code__iexact=options["project"])

        narrowed = [m for m in memberships if internal_scope.is_narrowed(m)]
        flagged = 0

        for membership in narrowed:
            problems = self._problems(membership)
            label = (
                f"{membership.project.code} / {membership.user.email}: "
                f"show={membership.show.code if membership.show_id else '-'} "
                f"department={membership.department or membership.department_id or '-'}"
            )
            if problems:
                flagged += 1
                self.stdout.write(self.style.WARNING(f"FLAG  {label}"))
                for problem in problems:
                    self.stdout.write(f"        {problem}")
            else:
                self.stdout.write(f"ok    {label}")

        self.stdout.write(f"{len(narrowed)} narrowed membership(s) checked, {flagged} flagged.")

        if flagged:
            raise SystemExit(1)

    def _problems(self, membership) -> list[str]:
        problems: list[str] = []
        narrowing = internal_scope.narrowing_of(membership)

        if narrowing.by_show:
            assigned = sum(
                model.objects.filter(project_id=membership.project_id, show_id=membership.show_id)
                .only("pk")
                .count()
                for _name, model in UNASSIGNED
            )
            if not assigned:
                problems.append("no episode, sequence, shot or asset is assigned to this show")

        if narrowing.by_department:
            tasks = internal_scope.department_tasks(narrowing)
            if not tasks.exists():
                known = sorted(
                    {
                        value
                        for value in Task.objects.filter(project_id=membership.project_id)
                        .exclude(Q(department="") & Q(department_id=""))
                        .values_list("department", flat=True)
                        if value
                    }
                )
                problems.append(
                    "no task of this project has this department"
                    + (f" (departments in use: {', '.join(known)})" if known else "")
                )

        if narrowing.by_show and narrowing.by_department:
            tasks = internal_scope.department_tasks(narrowing).filter(
                Q(shot__show_id=membership.show_id)
                | Q(asset__show_id=membership.show_id)
                | Q(sequence__show_id=membership.show_id)
            )
            if not tasks.exists() and not problems:
                problems.append("no task of this department belongs to this show")

        return problems
