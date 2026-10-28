"""
Assign a project's unassigned episodes, sequences, shots and assets to a show (TPN review TM-002).

A membership bound to a show sees only records of that show, so records created before the link
existed (or by a project-wide member) are hidden from it until they are assigned.

    manage.py assign_shows --project PROJ001 --show MAIN [--models shots,assets] [--reassign] [--dry-run]
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.production.models import Asset, Episode, Project, Sequence, Shot, Show

MODELS = {"episodes": Episode, "sequences": Sequence, "shots": Shot, "assets": Asset}


class Command(BaseCommand):
    help = "Assign a project's episodes, sequences, shots and assets to a show."

    def add_arguments(self, parser):
        parser.add_argument("--project", required=True, help="Project code.")
        parser.add_argument("--show", required=True, help="Code of a show of that project.")
        parser.add_argument(
            "--models",
            default=",".join(MODELS),
            help=f"Comma-separated subset of: {', '.join(MODELS)} (default: all).",
        )
        parser.add_argument(
            "--reassign",
            action="store_true",
            help="Also move records already assigned to another show (default: only unassigned).",
        )
        parser.add_argument("--dry-run", action="store_true", help="Count; change nothing.")

    def handle(self, *args, **options):
        project = Project.objects.filter(code__iexact=options["project"]).first()
        if project is None:
            raise CommandError(f"No project with code {options['project']!r}.")

        show = Show.objects.filter(project=project, code__iexact=options["show"]).first()
        if show is None:
            raise CommandError(f"Project {project.code} has no show {options['show']!r}.")

        names = [name.strip() for name in options["models"].split(",") if name.strip()]
        unknown = [name for name in names if name not in MODELS]
        if unknown:
            raise CommandError(f"Unknown model(s): {', '.join(unknown)}.")

        with transaction.atomic():
            for name in names:
                rows = MODELS[name].objects.filter(project=project)
                if not options["reassign"]:
                    rows = rows.filter(show__isnull=True)
                rows = rows.exclude(show=show)

                count = rows.count() if options["dry_run"] else rows.update(show=show)
                verb = "Would assign" if options["dry_run"] else "Assigned"
                self.stdout.write(f"{verb} {count} {name} of {project.code} to show {show.code}")
