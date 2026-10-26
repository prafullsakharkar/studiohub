"""
Read-only report of production data that the hierarchy constraints would reject or
leave unresolved. Run it before migrating a shared database, and after, to see what
is left:

    uv run python manage.py report_production_data [--fail-on-findings]

* codes that collide when case is ignored (per project, per entity; soft-deleted rows count)
* frame ranges that run backwards
* shots whose ``sequence_code`` names no sequence of their project (they keep
  ``sequence = NULL`` after migration; see DECISIONS D-11)

Nothing is changed. It reads the database selected by ``DJANGO_ENV``.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.production.models import Asset, Episode, Sequence, Shot, Task, Version

CODED = (Episode, Sequence, Shot, Asset, Task, Version)
FRAME_RANGES = (
    (Episode, "frame_in", "frame_out"),
    (Sequence, "frame_in", "frame_out"),
    (Shot, "frame_in", "frame_out"),
    (Version, "start_frame", "end_frame"),
)


def case_variant_codes():
    """``[(model name, project id, [codes], [ids])]`` for codes used more than once, any case."""
    found = []
    for model in CODED:
        groups: dict[tuple[object, str], list[tuple[str, str]]] = {}
        for pk, project_id, code in model.all_objects.values_list(
            "pk", "project_id", "code"
        ).iterator():
            groups.setdefault((project_id, (code or "").upper()), []).append((str(pk), code))
        for (project_id, _), rows in groups.items():
            if len(rows) > 1:
                found.append(
                    (model.__name__, project_id, sorted({c for _, c in rows}), [i for i, _ in rows])
                )
    return found


def backwards_frame_ranges():
    found = []
    for model, low, high in FRAME_RANGES:
        for pk, a, b in model.all_objects.values_list("pk", low, high).iterator():
            if a is not None and b is not None and b < a:
                found.append((model.__name__, str(pk), a, b))
    return found


def unmatched_shot_sequences():
    """``{(project id, sequence_code): [shot ids]}`` for shots naming no sequence of their project."""
    known = {
        (project_id, (code or "").upper())
        for project_id, code in Sequence.all_objects.values_list("project_id", "code")
    }
    unmatched: dict[tuple[object, str], list[str]] = {}
    for pk, project_id, code in Shot.all_objects.exclude(sequence_code="").values_list(
        "pk", "project_id", "sequence_code"
    ):
        if (project_id, code.upper()) not in known:
            unmatched.setdefault((project_id, code), []).append(str(pk))
    return unmatched


class Command(BaseCommand):
    help = "Read-only report of production data the hierarchy constraints would reject or leave unresolved."

    def add_arguments(self, parser):
        parser.add_argument(
            "--fail-on-findings",
            action="store_true",
            help="exit with status 1 when anything is listed",
        )

    def handle(self, *args, **options):
        findings = 0

        duplicates = case_variant_codes()
        self.stdout.write(f"Codes that differ only by case: {len(duplicates)} group(s)")
        for name, project_id, codes, ids in duplicates:
            findings += 1
            self.stdout.write(f"  {name} project={project_id} codes={codes} ids={ids[:5]}")

        ranges = backwards_frame_ranges()
        self.stdout.write(f"Frame ranges running backwards: {len(ranges)}")
        for name, pk, low, high in ranges[:50]:
            findings += 1
            self.stdout.write(f"  {name} {pk}: {low} -> {high}")

        unmatched = unmatched_shot_sequences()
        total = sum(len(ids) for ids in unmatched.values())
        self.stdout.write(
            f"Shots naming no sequence of their project: {total} shot(s) in {len(unmatched)} group(s)"
        )
        for (project_id, code), ids in sorted(
            unmatched.items(), key=lambda item: (str(item[0][0]), item[0][1])
        ):
            findings += 1
            self.stdout.write(
                f"  project={project_id} sequence_code={code!r}: {len(ids)} shot(s), e.g. {ids[:3]}"
            )

        self.stdout.write(self.style.SUCCESS("Done. Nothing was changed."))
        if options["fail_on_findings"] and findings:
            raise SystemExit(1)
