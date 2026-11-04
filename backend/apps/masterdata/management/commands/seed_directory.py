"""
Seed departments and positions with a typical VFX studio set (idempotent).

Rows are created through the department and position services. A row whose code or name already
exists (live or soft-deleted) is left as it is, never overwritten or brought back, so the command
is safe to run again, after ``init_platform`` and after hand edits. Teams, offices and people are
not touched.

Usage:
  python manage.py seed_directory [--dry-run]
"""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.masterdata.models import Department, Position
from apps.masterdata.services.organization import DepartmentService, PositionService

# (code, name, department_type, description)
DEPARTMENTS: list[tuple[str, str, str, str]] = [
    # The ones ``init_platform`` seeds (skipped when present), so a position never lacks its department.
    ("DEPT-EDIT", "Editorial", "production", "Editorial and conform"),
    ("DEPT-PIPELINE", "Pipeline TD", "technical", "Pipeline and tools development"),
    ("DEPT-COMP", "Compositing", "creative", "Compositing"),
    ("DEPT-FX", "FX", "creative", "Effects and simulation"),
    ("DEPT-LIGHT", "Lighting", "creative", "Lighting and rendering"),
    ("DEPT-ANIM", "Animation", "creative", "Character and creature animation"),
    ("DEPT-PROD", "Production", "production", "Scheduling, budgets and client communication"),
    ("DEPT-MM", "Matchmove", "technical", "Camera and object tracking"),
    ("DEPT-ROTO", "Roto & Paint", "creative", "Rotoscoping, paint and cleanup"),
    ("DEPT-LAYOUT", "Layout", "creative", "Camera and set layout"),
    ("DEPT-MODEL", "Modeling", "creative", "Asset modeling and sculpting"),
    ("DEPT-TEX", "Texturing & Look Dev", "creative", "Textures, shading and look development"),
    ("DEPT-RIG", "Rigging", "technical", "Character and prop rigs"),
    ("DEPT-DATA", "Data & I/O", "support", "Ingest, delivery and data wrangling"),
    ("DEPT-IT", "IT & Systems", "support", "Workstations, storage and network"),
    ("DEPT-HR", "HR & Admin", "administration", "People and administration"),
    ("DEPT-FIN", "Finance", "administration", "Accounts and payroll"),
]

# (code, name, department_code, level, is_managerial); the department may be a seeded or new one.
POSITIONS: list[tuple[str, str, str, int, bool]] = [
    ("POS-EXEC-PRODUCER", "Executive Producer", "DEPT-PROD", 5, True),
    ("POS-VFX-PRODUCER", "VFX Producer", "DEPT-PROD", 4, True),
    ("POS-PROD-MANAGER", "Production Manager", "DEPT-PROD", 3, True),
    ("POS-PROD-COORD", "Production Coordinator", "DEPT-PROD", 1, False),
    ("POS-COMP-SUP", "Compositing Supervisor", "DEPT-COMP", 3, True),
    ("POS-SR-ARTIST", "Senior Artist", "DEPT-COMP", 2, False),
    ("POS-ROTO-ARTIST", "Roto Artist", "DEPT-ROTO", 1, False),
    ("POS-PAINT-ARTIST", "Paint Artist", "DEPT-ROTO", 1, False),
    ("POS-MM-ARTIST", "Matchmove Artist", "DEPT-MM", 1, False),
    ("POS-LAYOUT-ARTIST", "Layout Artist", "DEPT-LAYOUT", 1, False),
    ("POS-ANIM-SUP", "Animation Supervisor", "DEPT-ANIM", 3, True),
    ("POS-ANIMATOR", "Animator", "DEPT-ANIM", 1, False),
    ("POS-FX-SUP", "FX Supervisor", "DEPT-FX", 3, True),
    ("POS-FX-ARTIST", "FX Artist", "DEPT-FX", 1, False),
    ("POS-LIGHT-LEAD", "Lighting Lead", "DEPT-LIGHT", 2, True),
    ("POS-LIGHT-ARTIST", "Lighting Artist", "DEPT-LIGHT", 1, False),
    ("POS-MODELER", "Modeler", "DEPT-MODEL", 1, False),
    ("POS-TEX-ARTIST", "Texture Artist", "DEPT-TEX", 1, False),
    ("POS-LOOKDEV-ARTIST", "Look Development Artist", "DEPT-TEX", 2, False),
    ("POS-RIGGER", "Rigging TD", "DEPT-RIG", 1, False),
    ("POS-EDITOR", "Editor", "DEPT-EDIT", 1, False),
    ("POS-ASST-EDITOR", "Assistant Editor", "DEPT-EDIT", 1, False),
    ("POS-PIPELINE-DEV", "Pipeline Developer", "DEPT-PIPELINE", 2, False),
    ("POS-DATA-WRANGLER", "Data Wrangler", "DEPT-DATA", 1, False),
    ("POS-SYSADMIN", "Systems Administrator", "DEPT-IT", 2, False),
    ("POS-HR-MANAGER", "HR Manager", "DEPT-HR", 3, True),
    ("POS-ACCOUNTANT", "Accountant", "DEPT-FIN", 2, False),
]


def _taken(model: Any, code: str, name: str) -> bool:
    """Whether a live or soft-deleted row already has this code or name (case-insensitive)."""
    return model.all_objects.filter(Q(code__iexact=code) | Q(name__iexact=name)).exists()


class Command(BaseCommand):
    help = "Seed departments and positions with a typical VFX studio set. Idempotent."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Count what would be created.")

    def handle(self, *args, **options):
        dry = bool(options["dry_run"])
        departments = positions = 0

        for code, name, department_type, description in DEPARTMENTS:
            if _taken(Department, code, name):
                continue
            departments += 1
            if not dry:
                DepartmentService.create(
                    actor=None,
                    data={
                        "code": code,
                        "name": name,
                        "department_type": department_type,
                        "description": description,
                    },
                )

        for code, name, department_code, level, managerial in POSITIONS:
            if _taken(Position, code, name):
                continue
            positions += 1
            if dry:
                continue
            department = Department.objects.filter(code__iexact=department_code).first()
            data: dict[str, Any] = {
                "code": code,
                "name": name,
                "level": level,
                "is_managerial": managerial,
            }
            if department is not None:  # removed by hand: the position is created without one
                data["department"] = department.pk
            PositionService.create(actor=None, data=data)

        verb = "would create" if dry else "created"
        self.stdout.write(f"departments: {verb} {departments}")
        self.stdout.write(f"positions: {verb} {positions}")
