"""
Seed departments, positions, offices, clients and vendors with a typical VFX studio set
(idempotent).

Rows are created through the masterdata services. A row whose code or name already exists (live or
soft-deleted) is left as it is, never overwritten or brought back, so the command is safe to run
again, after ``init_platform`` and after hand edits. No seeded office is the headquarters, so the
one already named keeps that role. The clients and vendors are made-up companies with
``example.com`` addresses. Teams, people and contracts are not touched.

Usage:
  python manage.py seed_directory [--dry-run]
"""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.masterdata.models import Client, Department, Office, Position, Vendor
from apps.masterdata.services.organization import DepartmentService, OfficeService, PositionService
from apps.masterdata.services.partner import ClientService, VendorService

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

# Offices, with ``code`` and ``name`` first; never ``is_headquarters`` (see the module docstring).
OFFICES: list[dict[str, Any]] = [
    {
        "code": "OFF-MUM",
        "name": "Mumbai Studio",
        "office_type": "headquarters",
        "timezone": "Asia/Kolkata",
        "country": "India",
        "state": "Maharashtra",
        "city": "Mumbai",
        "working_hours": "10:00-19:00",
    },
    {
        "code": "OFF-BLR",
        "name": "Bengaluru Lab",
        "office_type": "branch",
        "timezone": "Asia/Kolkata",
        "country": "India",
        "state": "Karnataka",
        "city": "Bengaluru",
        "working_hours": "10:00-19:00",
    },
    {
        "code": "OFF-HYD",
        "name": "Hyderabad Studio",
        "office_type": "branch",
        "timezone": "Asia/Kolkata",
        "country": "India",
        "state": "Telangana",
        "city": "Hyderabad",
        "working_hours": "10:00-19:00",
        "workstations_count": 120,
        "render_nodes_count": 40,
    },
    {
        "code": "OFF-PUN",
        "name": "Pune Studio",
        "office_type": "branch",
        "timezone": "Asia/Kolkata",
        "country": "India",
        "state": "Maharashtra",
        "city": "Pune",
        "working_hours": "10:00-19:00",
        "workstations_count": 80,
        "render_nodes_count": 24,
    },
    {
        "code": "OFF-LDN",
        "name": "London Office",
        "office_type": "client office",
        "timezone": "Europe/London",
        "country": "United Kingdom",
        "city": "London",
        "working_hours": "09:00-18:00",
        "workstations_count": 12,
    },
    {
        "code": "OFF-LA",
        "name": "Los Angeles Office",
        "office_type": "client office",
        "timezone": "America/Los_Angeles",
        "country": "United States",
        "state": "California",
        "city": "Los Angeles",
        "working_hours": "09:00-18:00",
        "workstations_count": 10,
    },
    {
        "code": "OFF-VAN",
        "name": "Vancouver Studio",
        "office_type": "branch",
        "timezone": "America/Vancouver",
        "country": "Canada",
        "state": "British Columbia",
        "city": "Vancouver",
        "working_hours": "09:00-18:00",
        "workstations_count": 60,
        "render_nodes_count": 20,
    },
]

# Clients (made-up companies), with ``code`` and ``name`` first.
CLIENTS: list[dict[str, Any]] = [
    {
        "code": "CLI-NPP",
        "name": "Northpoint Pictures",
        "studio_type": "Major Studio",
        "contract_tier": "Premier Partner",
        "contact_name": "Production Office",
        "email": "vfx@northpoint.example.com",
        "headquarters": "Los Angeles, United States",
    },
    {
        "code": "CLI-HLS",
        "name": "Harbour Light Studios",
        "studio_type": "Major Studio",
        "contract_tier": "Standard Producer",
        "contact_name": "Post Production",
        "email": "post@harbourlight.example.com",
        "headquarters": "London, United Kingdom",
    },
    {
        "code": "CLI-BRS",
        "name": "Blue River Streaming",
        "studio_type": "Streaming Platform",
        "contract_tier": "Premier Partner",
        "contact_name": "Originals Team",
        "email": "originals@blueriver.example.com",
        "headquarters": "Los Angeles, United States",
    },
    {
        "code": "CLI-SMF",
        "name": "Saffron Motion Films",
        "studio_type": "Independent",
        "contract_tier": "Standard Producer",
        "contact_name": "Line Producer",
        "email": "lineproducer@saffronmotion.example.com",
        "headquarters": "Mumbai, India",
    },
    {
        "code": "CLI-KTV",
        "name": "Kestrel Television",
        "studio_type": "Broadcaster",
        "contract_tier": "Standard Producer",
        "contact_name": "Drama Department",
        "email": "drama@kestreltv.example.com",
        "headquarters": "Toronto, Canada",
    },
    {
        "code": "CLI-LAN",
        "name": "Lantern Animation",
        "studio_type": "Animation Studio",
        "contract_tier": "Project Based",
        "contact_name": "Studio Office",
        "email": "studio@lantern.example.com",
        "headquarters": "Vancouver, Canada",
        "portal_access": False,
    },
]

# Vendors (made-up companies), with ``code`` and ``name`` first.
VENDORS: list[dict[str, Any]] = [
    {
        "code": "VEN-PIX",
        "name": "Pixelgrain Roto",
        "specialization": "Roto & Paint",
        "security_tier": "Standard Studio NDA",
        "nda_signed": True,
        "rating": "4.60",
        "location": "Pune, India",
        "email": "bids@pixelgrain.example.com",
    },
    {
        "code": "VEN-TRK",
        "name": "Trackline Matchmove",
        "specialization": "Matchmove",
        "security_tier": "Standard Studio NDA",
        "nda_signed": True,
        "rating": "4.40",
        "location": "Chennai, India",
        "email": "hello@trackline.example.com",
    },
    {
        "code": "VEN-EMB",
        "name": "Ember FX House",
        "specialization": "FX & Simulation",
        "security_tier": "TPN Assessed",
        "nda_signed": True,
        "rating": "4.80",
        "location": "Montreal, Canada",
        "email": "studio@emberfx.example.com",
        "bandwidth_gbps": "20",
    },
    {
        "code": "VEN-CNV",
        "name": "Canvas Paint Studio",
        "specialization": "Paint & Cleanup",
        "security_tier": "Standard Studio NDA",
        "nda_signed": False,
        "rating": "4.20",
        "location": "Kolkata, India",
        "status": "Under Review",
        "email": "contact@canvaspaint.example.com",
    },
    {
        "code": "VEN-STR",
        "name": "Stereo Forge",
        "specialization": "Stereo Conversion",
        "security_tier": "TPN Assessed",
        "nda_signed": True,
        "rating": "4.50",
        "location": "London, United Kingdom",
        "email": "projects@stereoforge.example.com",
    },
    {
        "code": "VEN-RND",
        "name": "Rendernest Cloud",
        "specialization": "Render Farm",
        "security_tier": "TPN Assessed",
        "nda_signed": True,
        "rating": "4.70",
        "location": "Hyderabad, India",
        "email": "support@rendernest.example.com",
        "bandwidth_gbps": "40",
    },
]


def _taken(model: Any, code: str, name: str) -> bool:
    """Whether a live or soft-deleted row already has this code or name (case-insensitive)."""
    return model.all_objects.filter(Q(code__iexact=code) | Q(name__iexact=name)).exists()


class Command(BaseCommand):
    help = (
        "Seed departments, positions, offices, clients and vendors with a typical VFX studio set."
        " Idempotent."
    )

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

        offices = self._seed(Office, OfficeService, OFFICES, dry)
        clients = self._seed(Client, ClientService, CLIENTS, dry)
        vendors = self._seed(Vendor, VendorService, VENDORS, dry)

        verb = "would create" if dry else "created"
        self.stdout.write(f"departments: {verb} {departments}")
        self.stdout.write(f"positions: {verb} {positions}")
        self.stdout.write(f"offices: {verb} {offices}")
        self.stdout.write(f"clients: {verb} {clients}")
        self.stdout.write(f"vendors: {verb} {vendors}")

    @staticmethod
    def _seed(model: Any, service: Any, rows: list[dict[str, Any]], dry: bool) -> int:
        created = 0
        for row in rows:
            if _taken(model, row["code"], row["name"]):
                continue
            created += 1
            if not dry:
                service.create(actor=None, data=dict(row))
        return created
