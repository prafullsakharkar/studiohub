"""
Seed the platform catalog tabs with a working starting set (idempotent).

Tabs: software (with a few versions), statuses (the entity types ``init_platform`` leaves out),
task, asset, shot, review and file types. Rows are created through the catalog services as
``system`` rows. A row whose code or name already exists (live or soft-deleted) is left as it
is, never overwritten, so the command is safe to run again and after hand edits.

Usage:
  python manage.py seed_catalog [--dry-run]
"""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.masterdata.models import (
    MasterAssetType,
    MasterFileType,
    MasterReviewType,
    MasterShotType,
    MasterStatus,
    MasterTaskType,
    Software,
    SoftwareVersion,
)
from apps.masterdata.services.catalog import (
    MasterAssetTypeService,
    MasterFileTypeService,
    MasterReviewTypeService,
    MasterShotTypeService,
    MasterStatusService,
    MasterTaskTypeService,
)
from apps.masterdata.services.software import SoftwareService, SoftwareVersionService

# (code, name, publisher, category, website)
SOFTWARE: list[tuple[str, str, str, str, str]] = [
    ("maya", "Maya", "Autodesk", "DCC", "https://www.autodesk.com"),
    ("houdini", "Houdini", "SideFX", "FX", "https://www.sidefx.com"),
    ("nuke", "Nuke", "Foundry", "Compositing", "https://www.foundry.com"),
    ("blender", "Blender", "Blender Foundation", "DCC", "https://www.blender.org"),
    ("katana", "Katana", "Foundry", "Lighting", "https://www.foundry.com"),
    ("mari", "Mari", "Foundry", "Texturing", "https://www.foundry.com"),
    ("substance-painter", "Substance Painter", "Adobe", "Texturing", "https://www.adobe.com"),
    ("zbrush", "ZBrush", "Maxon", "Sculpting", "https://www.maxon.net"),
    (
        "resolve",
        "DaVinci Resolve",
        "Blackmagic Design",
        "Editorial",
        "https://www.blackmagicdesign.com",
    ),
]

# (software code, version)
SOFTWARE_VERSIONS: list[tuple[str, str]] = [
    ("maya", "2025"),
    ("maya", "2026"),
    ("houdini", "20.5"),
    ("houdini", "21.0"),
    ("nuke", "15.1"),
    ("nuke", "16.0"),
    ("blender", "4.2"),
    ("blender", "4.5"),
]

# (code, name, entity_type, category, is_default, is_final); categories are StatusCategory values.
STATUSES: list[tuple[str, str, str, str, bool, bool]] = [
    ("planning", "Planning", "Project", "not_started", True, False),
    ("active", "Active", "Project", "in_progress", False, False),
    ("completed", "Completed", "Project", "done", False, True),
    ("cancelled", "Cancelled", "Project", "cancelled", False, True),
    ("not-started", "Not Started", "Sequence", "not_started", True, False),
    ("in-progress", "In Progress", "Sequence", "in_progress", False, False),
    ("approved", "Approved", "Sequence", "done", False, True),
    ("not-started", "Not Started", "Asset", "not_started", True, False),
    ("in-progress", "In Progress", "Asset", "in_progress", False, False),
    ("in-review", "In Review", "Asset", "review", False, False),
    ("approved", "Approved", "Asset", "done", False, True),
    ("omitted", "Omitted", "Asset", "cancelled", False, True),
    ("pending-review", "Pending Review", "Version", "review", True, False),
    ("revise", "Revise", "Version", "in_progress", False, False),
    ("approved", "Approved", "Version", "done", False, True),
    ("rejected", "Rejected", "Version", "cancelled", False, True),
    ("pending", "Pending", "Review", "not_started", True, False),
    ("in-review", "In Review", "Review", "review", False, False),
    ("changes-requested", "Changes Requested", "Review", "in_progress", False, False),
    ("approved", "Approved", "Review", "done", False, True),
    ("draft", "Draft", "Delivery", "not_started", True, False),
    ("packaging", "Packaging", "Delivery", "in_progress", False, False),
    ("ready", "Ready to Send", "Delivery", "review", False, False),
    ("delivered", "Delivered", "Delivery", "done", False, True),
    ("rejected", "Rejected", "Delivery", "cancelled", False, True),
]

# (code, name, category, department_code, department_name); department codes are the seeded ones.
TASK_TYPES: list[tuple[str, str, str, str, str]] = [
    ("matchmove", "Matchmove", "Shot", "", ""),
    ("layout", "Layout", "Shot", "", ""),
    ("animation", "Animation", "Shot", "", ""),
    ("fx", "FX", "Shot", "DEPT-FX", "FX"),
    ("lighting", "Lighting", "Shot", "DEPT-LIGHT", "Lighting"),
    ("roto", "Roto", "Shot", "DEPT-COMP", "Compositing"),
    ("paint", "Paint", "Shot", "DEPT-COMP", "Compositing"),
    ("comp", "Compositing", "Shot", "DEPT-COMP", "Compositing"),
    ("modeling", "Modeling", "Asset", "", ""),
    ("texturing", "Texturing", "Asset", "", ""),
    ("rigging", "Rigging", "Asset", "", ""),
    ("lookdev", "Look Development", "Asset", "", ""),
    ("editorial", "Editorial", "Production", "DEPT-EDIT", "Editorial"),
    ("pipeline-support", "Pipeline Support", "Support", "DEPT-PIPELINE", "Pipeline TD"),
]

# (code, name)
ASSET_TYPES: list[tuple[str, str]] = [
    ("character", "Character"),
    ("prop", "Prop"),
    ("environment", "Environment"),
    ("vehicle", "Vehicle"),
    ("set", "Set"),
    ("matte-painting", "Matte Painting"),
    ("fx-element", "FX Element"),
    ("hdri", "HDRI"),
]

# (code, name, default_handle_frames)
SHOT_TYPES: list[tuple[str, str, int | None]] = [
    ("live-action", "Live Action Plate", 8),
    ("greenscreen", "Green / Blue Screen", 8),
    ("plate-extension", "Plate Extension", 8),
    ("full-cg", "Full CG", 0),
    ("insert", "Insert", 8),
    ("stock-element", "Stock Element", None),
]

# (code, name, allow_verdicts, require_notes)
REVIEW_TYPES: list[tuple[str, str, bool, bool]] = [
    ("dailies", "Dailies", False, True),
    ("internal", "Internal Review", True, False),
    ("supervisor", "Supervisor Review", True, True),
    ("client", "Client Review", True, True),
    ("final-qc", "Final QC", True, True),
]

# (extension, name, mime_type, category, dcc_affinity); the code is the extension.
FILE_TYPES: list[tuple[str, str, str, str, str]] = [
    ("exr", "OpenEXR", "image/x-exr", "Image", "Nuke"),
    ("dpx", "DPX", "image/x-dpx", "Image", "Nuke"),
    ("png", "PNG", "image/png", "Image", ""),
    ("jpg", "JPEG", "image/jpeg", "Image", ""),
    ("mov", "QuickTime", "video/quicktime", "Video", ""),
    ("mp4", "MP4", "video/mp4", "Video", ""),
    ("abc", "Alembic", "application/octet-stream", "Geometry", "Maya"),
    ("usd", "USD", "application/octet-stream", "Scene", "Houdini"),
    ("fbx", "FBX", "application/octet-stream", "Geometry", "Maya"),
    ("obj", "OBJ", "model/obj", "Geometry", ""),
    ("ma", "Maya ASCII", "application/octet-stream", "Scene", "Maya"),
    ("mb", "Maya Binary", "application/octet-stream", "Scene", "Maya"),
    ("hip", "Houdini Scene", "application/octet-stream", "Scene", "Houdini"),
    ("nk", "Nuke Script", "text/plain", "Scene", "Nuke"),
    ("blend", "Blender Scene", "application/x-blender", "Scene", "Blender"),
    ("cube", "LUT (.cube)", "text/plain", "Color", ""),
    ("pdf", "PDF", "application/pdf", "Document", ""),
]


def _taken(model: Any, code: str, name: str, **scope: Any) -> bool:
    """Whether a live or soft-deleted row already has this code or name (case-insensitive)."""
    return model.all_objects.filter(Q(code__iexact=code) | Q(name__iexact=name), **scope).exists()


class Command(BaseCommand):
    help = (
        "Seed the catalog tabs (software, statuses, task/asset/shot/review/file types). Idempotent."
    )

    dry: bool = False

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Count what would be created.")

    def handle(self, *args, **options):
        self.dry = bool(options["dry_run"])
        counts = {
            "software": self._software(),
            "software versions": self._versions(),
            "statuses": self._statuses(),
            "task types": self._simple(
                MasterTaskType,
                MasterTaskTypeService,
                [
                    {
                        "code": c,
                        "name": n,
                        "category": cat,
                        "department_code": dc,
                        "department_name": dn,
                        "sort_order": i,
                    }
                    for i, (c, n, cat, dc, dn) in enumerate(TASK_TYPES)
                ],
            ),
            "asset types": self._simple(
                MasterAssetType,
                MasterAssetTypeService,
                [{"code": c, "name": n, "sort_order": i} for i, (c, n) in enumerate(ASSET_TYPES)],
            ),
            "shot types": self._simple(
                MasterShotType,
                MasterShotTypeService,
                [
                    {"code": c, "name": n, "default_handle_frames": h, "sort_order": i}
                    for i, (c, n, h) in enumerate(SHOT_TYPES)
                ],
            ),
            "review types": self._simple(
                MasterReviewType,
                MasterReviewTypeService,
                [
                    {
                        "code": c,
                        "name": n,
                        "allow_verdicts": a,
                        "require_notes": r,
                        "sort_order": i,
                    }
                    for i, (c, n, a, r) in enumerate(REVIEW_TYPES)
                ],
            ),
            "file types": self._file_types(),
        }
        verb = "would create" if self.dry else "created"
        for tab, count in counts.items():
            self.stdout.write(f"{tab}: {verb} {count}")

    def _create(self, service: Any, data: dict[str, Any], **kwargs: Any) -> int:
        if not self.dry:
            service.create(actor=None, system=True, data=data, **kwargs)
        return 1

    def _simple(self, model: Any, service: Any, rows: list[dict[str, Any]]) -> int:
        created = 0
        for row in rows:
            if _taken(model, row["code"], row["name"]):
                continue
            created += self._create(service, row)
        return created

    def _software(self) -> int:
        created = 0
        for i, (code, name, publisher, category, website) in enumerate(SOFTWARE):
            if _taken(Software, code, name):
                continue
            created += self._create(
                SoftwareService,
                {
                    "code": code,
                    "name": name,
                    "publisher": publisher,
                    "category": category,
                    "website": website,
                    "sort_order": i,
                },
            )
        return created

    def _versions(self) -> int:
        created = 0
        for i, (software_code, version) in enumerate(SOFTWARE_VERSIONS):
            parent = Software.objects.filter(code__iexact=software_code).first()
            if parent is None:
                continue  # dry run before the software exists, or the software was removed by hand
            if SoftwareVersion.all_objects.filter(software=parent, version=version).exists():
                continue
            created += self._create(
                SoftwareVersionService, {"version": version, "sort_order": i}, parent=parent
            )
        return created

    def _statuses(self) -> int:
        created = 0
        for i, (code, name, entity_type, category, is_default, is_final) in enumerate(STATUSES):
            if _taken(MasterStatus, code, name, entity_type=entity_type):
                continue
            created += self._create(
                MasterStatusService,
                {
                    "code": code,
                    "name": name,
                    "entity_type": entity_type,
                    "category": category,
                    "is_default": is_default,
                    "is_final": is_final,
                    "order": i,
                },
            )
        return created

    def _file_types(self) -> int:
        created = 0
        for i, (extension, name, mime, category, dcc) in enumerate(FILE_TYPES):
            if MasterFileType.all_objects.filter(
                Q(code__iexact=extension) | Q(name__iexact=name) | Q(extension__iexact=extension)
            ).exists():
                continue
            created += self._create(
                MasterFileTypeService,
                {
                    "extension": extension,
                    "name": name,
                    "mime_type": mime,
                    "category": category,
                    "dcc_affinity": dcc,
                    "sort_order": i,
                },
            )
        return created
