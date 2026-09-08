"""
Seed the StudioHub backend from the studiohub-react frontend mock dataset.

Canonical seed entry point (preferred over ``seed_dev``/``seed_demo_data``
for contract work)::

    uv run python manage.py seed_studiohub --force
    uv run python manage.py seed_studiohub --force --dry-run
    uv run python manage.py seed_studiohub --force --reset
    uv run python manage.py seed_studiohub --force --only production
    uv run python manage.py seed_studiohub --validate-only

What it does:

1. Runs the ``seed_dev`` foundation unless ``--skip-base`` (organizations,
   users, roles, permission catalog, in-repo production mocks, clients,
   billing, knowledge, activities, deliveries).
2. Overlays the studiohub-react mock dataset (source of truth for sample
   data): all mock organizations with their own projects, production
   entities per organization, mock-driven user/roleenburg memberships,
   supplemental persona users, editorial cuts, project notes, and activity
   project linkage.
3. Validates relationships and integrity afterwards (fails on critical
   violations unless ``--skip-validate``).

Contract rules honored:

- Idempotent: natural keys + ``update_or_create``/``get_or_create``; safe
  to re-run. Soft-deleted rows matching incoming keys are restored, never
  duplicated (§12).
- Mock ``is_deleted`` flags are preserved as soft-deleted rows so restore
  flows stay testable (§25).
- Memberships come from the mock, never blanket-granted (§9, §22).
- Nothing is destroyed without explicit ``--reset`` (§26, §27).
- ``--dry-run`` executes everything inside a rolled-back transaction and
  reports without writing (§16).
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

REACT_MOCK_FILES = {
    "organizations": ("organization/organization.ts", "mockOrganizations"),
    "users": ("identity/users.ts", "mockUsers"),
    "projects": ("production/projects.ts", "mockProjects"),
    "sequences": ("production/sequences.ts", "mockSequences"),
    "shots": ("production/shots.ts", "mockShots"),
    "assets": ("assets/assets.ts", "mockAssets"),
    "tasks": ("tasks/tasks.ts", "mockTasks"),
    "timelogs": ("tasks/timelogs.ts", "mockTimelogs"),
    "versions": ("versions/versions.ts", "mockVersions"),
    "reviews": ("reviews/reviews.ts", "mockReviews"),
    "playlists": ("production/playlists.ts", "mockPlaylists"),
    "media": ("production/media.ts", "mockMediaAssets"),
    "workflows": ("production/workflow.ts", "mockWorkflows"),
    "editorial": ("production/editorial.ts", "mockEditorialCuts"),
    "notes": ("production/notes.ts", "mockProjectNotes"),
}

# Mock user-id fields rewritten to emails before seeding (the production
# seeders resolve users by email, and mock ids like usr-002 match nothing).
USER_ID_FIELDS = {
    "supervisor_id",
    "coordinator_id",
    "assigned_artist_id",
    "approved_by_id",
    "assignee_id",
    "reviewer_id",
    "person_id",
    "artist_id",
    "author_id",
    "lead_reviewer_id",
    "lead_artist_id",
}

# Frontend permission codes the UI actually checks (audited from
# src/core/permissions + mockAuthGuard; tailwind `hover:*` excluded).
# Used by validation to confirm catalog coverage.
FRONTEND_PERMISSION_CODES = [
    "projects:create",
    "projects:read",
    "projects:update",
    "projects:delete",
    "shots:create",
    "shots:read",
    "shots:update",
    "shots:delete",
    "shots:approve",
    "assets:create",
    "assets:read",
    "assets:update",
    "assets:delete",
    "tasks:create",
    "tasks:read",
    "tasks:update",
    "tasks:delete",
    "reviews:create",
    "reviews:read",
    "reviews:approve",
    "audit:read",
    "settings:update",
    "users:manage",
    "deliveries:read",
    "publishing:read",
    "scheduling:read",
]

# Mock display role name -> existing global role code. Roles are global by
# code in this codebase, so cross-org memberships reuse the same role row.
# Assumptions documented in docs/SEED_DATA.md.
ROLE_NAME_MAP = {
    "Artist": "artist",
    "Lead Artist": "lead-artist",
    "VFX Supervisor": "vfx-supervisor",
    "Platform Admin": "platform-admin",
    "Organization Admin": "org-admin",
    "Client Reviewer": "client-reviewer",
    "Production Manager": "vfx-supervisor",
    "Producer": "vfx-supervisor",
    "Organization Owner": "org-admin",
}

_READ_PERMS = [
    "projects:read",
    "shots:read",
    "assets:read",
    "tasks:read",
    "reviews:read",
    "deliveries:read",
    "publishing:read",
]
_VENDOR_PERMS = [
    "projects:read",
    "shots:read",
    "assets:read",
    "tasks:read",
    "tasks:update",
    "reviews:read",
    "reviews:create",
    "deliveries:read",
]
_CLIENT_PERMS = [
    "projects:read",
    "shots:read",
    "reviews:read",
    "reviews:approve",
    "deliveries:read",
    "publishing:read",
]

# Supplemental global roles (mock names with no seeded equivalent).
# code: (display name, permission codes). Least privilege by design.
SUPPLEMENTAL_ROLES = {
    "viewer": ("Viewer", _READ_PERMS),
    "client-viewer": ("Client Viewer", _READ_PERMS),
    "auditor": ("Auditor", ["audit:read", "projects:read"]),
    "vendor-artist": ("Vendor Artist", _VENDOR_PERMS),
    "vendor-admin": ("Vendor Admin", _VENDOR_PERMS),
    "vendor-manager": ("Vendor Manager", _VENDOR_PERMS),
    "vendor-producer": ("Vendor Producer", _VENDOR_PERMS),
    "client-admin": ("Client Admin", _CLIENT_PERMS),
    "client-producer": ("Client Producer", _CLIENT_PERMS),
}

# All mock users become Django users (seed_dev covers 4; the rest are
# personas: client, vendor staff, viewer, auditor, producer, owner…).
# Names come from the mock; password is the documented dev default.

PHASES = ("base", "orgs", "production", "access", "content")


class SeedReporter:
    """Per-entity outcome counters with a §17-style summary."""

    OUTCOMES = (
        "created",
        "updated",
        "existing",
        "skipped",
        "restored",
        "processed",
        "errors",
    )

    def __init__(self):
        self.rows: dict[str, dict[str, int]] = {}
        self.messages: list[str] = []

    def add(self, entity, outcome, n=1):
        if outcome not in self.OUTCOMES:
            raise ValueError(f"unknown seed outcome: {outcome}")
        row = self.rows.setdefault(entity, dict.fromkeys(self.OUTCOMES, 0))
        row[outcome] += n

    def error(self, entity, message):
        self.add(entity, "errors")
        self.messages.append(f"{entity}: {message}")

    def note(self, entity, message):
        """Informational message (does not affect error counts)."""
        self.messages.append(f"{entity}: note: {message}")

    def totals(self):
        totals = dict.fromkeys(self.OUTCOMES, 0)
        for row in self.rows.values():
            for outcome in self.OUTCOMES:
                totals[outcome] += row[outcome]
        return totals

    def summary(self):
        lines = [
            "========================================",
            "StudioHub Seed Summary",
            "========================================",
            "",
        ]
        for entity in sorted(self.rows):
            row = self.rows[entity]
            parts = [f"{outcome}: {row[outcome]}" for outcome in self.OUTCOMES if row[outcome]]
            lines.append(f"{entity}\n  " + ("  ".join(parts) if parts else "no changes"))
        lines += ["", f"Errors: {self.totals()['errors']}", "========================================"]
        if self.messages:
            lines.append("Error details (first 20):")
            lines.extend(f"  - {message}" for message in self.messages[:20])
        return "\n".join(lines)


class Command(BaseCommand):
    help = "Seed backend data from the frontend mock dataset (canonical seed)."

    _timelog_task_map: dict[str, str] = {}
    _timelog_email_to_id: dict[str, str] = {}

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true",
                            help="Allow seeding even when DEBUG is False.")
        parser.add_argument("--reset", action="store_true",
                            help="Delete existing seed data before seeding (passed to seed_dev).")
        parser.add_argument("--skip-base", action="store_true",
                            help="Skip seed_dev; only apply the react-mock overlay.")
        parser.add_argument("--dry-run", action="store_true",
                            help="Compute and report everything, then roll back (no writes).")
        parser.add_argument("--skip-validate", action="store_true",
                            help="Skip post-seed relationship validation.")
        parser.add_argument("--validate-only", action="store_true",
                            help="Only run post-seed validation against current data.")
        parser.add_argument("--organizations", action="store_true",
                            help="Only ensure organizations (+ catalog).")
        parser.add_argument("--production", action="store_true",
                            help="Only seed the production overlay (+ org ensure).")
        parser.add_argument("--permissions", action="store_true",
                            help="Only ensure the permission catalog.")
        parser.add_argument("--access", action="store_true",
                            help="Only seed users/memberships (needs orgs).")
        parser.add_argument("--content", action="store_true",
                            help="Only seed editorial/notes/activity linkage.")

    # ------------------------------------------------------------------
    # Entry point
    # ------------------------------------------------------------------

    def handle(self, *args, **options):
        # Validation is read-only: no env gate needed.
        if options["validate_only"]:
            reporter = SeedReporter()
            criticals = self._validate(reporter)
            self.stdout.write(reporter.summary())
            if criticals:
                raise CommandError(f"Validation failed with {criticals} critical error(s).")
            self.stdout.write(self.style.SUCCESS("Validation passed."))
            return
        force = options["force"]
        allow_seed_env = os.getenv("ALLOW_SEED", "").lower() in ("1", "true", "yes")
        if not settings.DEBUG and not force and not allow_seed_env:
            raise CommandError(
                "Refusing to seed in production. Use --force or set ALLOW_SEED=1 / DEBUG=True."
            )

        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN — all writes will be rolled back.")
            )
        with transaction.atomic():
            self._run(options)
            if dry_run:
                transaction.set_rollback(True)

    def _run(self, options):
        reporter = SeedReporter()
        phases = self._select_phases(options)
        self.stdout.write(f"Mock source: {self._resolve_mock_root()}")
        if "base" in phases and not options["skip_base"]:
            call_command(
                "seed_dev",
                force=options["force"],
                reset=options["reset"],
                verbosity=options["verbosity"],
            )
        mock_root = self._resolve_mock_root()
        if "permissions" in phases:
            self._ensure_permission_catalog(reporter)
        org_by_code = None
        # Dependency order: orgs -> users -> production -> project access ->
        # content. Project memberships need projects; production FK
        # assignments (assignees, authors) need users to exist first.
        if "orgs" in phases:
            org_by_code = self._seed_overlay_orgs(mock_root, reporter)
        if "access-users" in phases:
            org_by_code = org_by_code or self._seed_overlay_orgs(mock_root, reporter)
            self._seed_overlay_access_users(mock_root, reporter, org_by_code)
        if "production" in phases:
            org_by_code = org_by_code or self._seed_overlay_orgs(mock_root, reporter)
            self._seed_overlay_production(mock_root, reporter, org_by_code=org_by_code)
        if "access-projects" in phases:
            org_by_code = org_by_code or self._seed_overlay_orgs(mock_root, reporter)
            self._seed_overlay_access_projects(mock_root, reporter)
        if "content" in phases:
            self._seed_overlay_content(mock_root, reporter)
        self.stdout.write(reporter.summary())
        if not options["skip_validate"]:
            criticals = self._validate(reporter)
            if criticals:
                raise CommandError(
                    f"Seed validation failed with {criticals} critical error(s)."
                )
            self.stdout.write(self.style.SUCCESS("Seed validation passed."))

    # Phase dependency closure: each phase implies its prerequisites.
    PHASE_DEPS = {
        "base": set(),
        "permissions": set(),
        "orgs": set(),
        "access-users": {"orgs"},
        "production": {"orgs", "access-users"},
        "access-projects": {"orgs", "access-users", "production"},
        "content": {"orgs", "production"},
    }

    def _select_phases(self, options):
        selected = set()
        if options["organizations"]:
            selected.add("orgs")
        if options["production"]:
            selected.add("production")
        if options["permissions"]:
            selected.add("permissions")
        if options["access"]:
            selected |= {"access-users", "access-projects"}
        if options["content"]:
            selected.add("content")
        if not selected:
            selected = {"base", "permissions", "orgs", "access-users",
                        "production", "access-projects", "content"}
        # Close over dependencies.
        closure = set(selected)
        changed = True
        while changed:
            changed = False
            for phase in list(closure):
                for dep in self.PHASE_DEPS.get(phase, set()):
                    if dep not in closure:
                        closure.add(dep)
                        changed = True
        if "base" not in closure and not options["skip_base"]:
            # Scoped runs skip the monolithic foundation unless asked.
            options["skip_base"] = True
        return closure

    # ------------------------------------------------------------------
    # Mock loading
    # ------------------------------------------------------------------

    def _resolve_mock_root(self) -> Path:
        candidates = []
        env_root = os.getenv("STUDIOHUB_REACT_MOCKS")
        if env_root:
            candidates.append(Path(env_root))
        # This file lives at <repo>/backend/apps/core/management/commands/.
        repo_root = Path(__file__).resolve().parents[5]
        candidates.append(repo_root.parent / "studiohub-react" / "src" / "mocks" / "db")
        candidates.append(repo_root / "frontend" / "src" / "mocks" / "db")
        for candidate in candidates:
            if candidate.is_dir():
                return candidate
        raise CommandError(
            "No mock dataset found. Set STUDIOHUB_REACT_MOCKS to .../src/mocks/db."
        )

    def _load(self, mock_root, key):
        from apps.production.management.commands.seed_production_mocks import (
            _load_ts_mock_array,
        )

        rel, var = REACT_MOCK_FILES[key]
        path = mock_root / rel
        if not path.is_file():
            alternates = {
                "timelogs": "production/timelogs.ts",
                "assets": "production/assets.ts",
            }
            if key in alternates:
                path = mock_root / alternates[key]
            if not path.is_file():
                return []
        try:
            return _load_ts_mock_array(path, var) or []
        except Exception as exc:  # noqa: BLE001
            self.stdout.write(f"  {key}: parse failed ({exc})")
            return []

    # ------------------------------------------------------------------
    # Phase: permission catalog (standalone-capable)
    # ------------------------------------------------------------------

    def _ensure_permission_catalog(self, reporter):
        from apps.core.management.commands.seed_dev import Command as SeedDevCommand

        cmd = SeedDevCommand()
        cmd.stdout = self.stdout
        perms = cmd._seed_permissions()
        reporter.add("permissions", "existing", len(perms))
        self.stdout.write(f"  permission catalog: {len(perms)} codes ensured")

    # ------------------------------------------------------------------
    # Phase: orgs
    # ------------------------------------------------------------------

    def _seed_overlay_orgs(self, mock_root, reporter, mock_orgs=None):
        from apps.organization.models import Organization

        mock_orgs = mock_orgs if mock_orgs is not None else self._load(mock_root, "organizations")
        org_by_code = {}
        for item in mock_orgs:
            code = (item.get("code") or "").strip().upper()
            if not code:
                reporter.add("organizations", "skipped")
                continue
            _, created = Organization.objects.update_or_create(
                code=code,
                defaults={
                    "name": item.get("name", code),
                    "slug": (item.get("slug") or code).lower(),
                    "status": "Active",
                },
            )
            reporter.add("organizations", "created" if created else "updated")
            org_by_code[code] = Organization.objects.get(code=code)
        return org_by_code

    # ------------------------------------------------------------------
    # Phase: production overlay
    # ------------------------------------------------------------------

    def _rewrite_user_ids(self, item, id_to_email):
        for key in USER_ID_FIELDS:
            value = item.get(key)
            if isinstance(value, str) and "@" not in value and value in id_to_email:
                item[key] = id_to_email[value]
        return item

    def _write_temp_ts(self, var_name, items):
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".ts", delete=False, prefix="seed_overlay_"
        ) as tmp:
            tmp.write(f"export const {var_name} = {json.dumps(items, default=str)};\n")
            return Path(tmp.name)

    def _restore_matching(self, model, lookup, reporter, entity):
        """§12: reuse soft-deleted rows instead of duplicating them."""
        try:
            obj = model.all_objects.filter(**lookup).first()
        except Exception:  # noqa: BLE001
            return
        if obj is not None and getattr(obj, "is_deleted", False):
            obj.is_deleted = False
            obj.deleted_at = None
            obj.save(update_fields=["is_deleted", "deleted_at", "updated_at"])
            reporter.add(entity, "restored")

    def _seed_overlay_production(self, mock_root, reporter, org_by_code=None):
        from unittest.mock import MagicMock

        from apps.production.management.commands.seed_production_mocks import (
            Command as ProdMockCommand,
        )
        from apps.production.models import (
            Asset,
            Media,
            Playlist,
            Project,
            Review,
            Sequence,
            Shot,
            Task,
            Version,
            Workflow,
        )

        if org_by_code is None:
            org_by_code = self._seed_overlay_orgs(mock_root, reporter)
        mock_orgs = self._load(mock_root, "organizations")
        mock_users = self._load(mock_root, "users")
        mock_org_id_to_code = {
            item.get("id"): (item.get("code") or "").strip().upper()
            for item in mock_orgs
            if item.get("id")
        }
        id_to_email = {
            item.get("id"): item.get("email")
            for item in mock_users
            if item.get("id") and item.get("email")
        }

        from apps.production.models import Timelog

        stats_models = {
            "projects": Project,
            "sequences": Sequence,
            "shots": Shot,
            "assets": Asset,
            "tasks": Task,
            "timelogs": Timelog,
            "versions": Version,
            "reviews": Review,
            "playlists": Playlist,
            "media": Media,
            "workflows": Workflow,
        }

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()

        # Projects first so later entities resolve project_code per org.
        projects = self._load(mock_root, "projects")
        by_org: dict[str, list[dict[str, Any]]] = {}
        for item in projects:
            code = mock_org_id_to_code.get(item.get("organization_id"), "")
            org = org_by_code.get(code)
            if org is None:
                reporter.add("projects", "skipped")
                continue
            self._rewrite_user_ids(item, id_to_email)
            self._restore_matching(
                Project,
                {"code": item.get("code"), "organization": org},
                reporter,
                "projects",
            )
            by_org.setdefault(org.code, []).append(item)
        for org_code, items in by_org.items():
            org = org_by_code[org_code]
            before = Project.objects.filter(organization=org).count()
            tmp = self._write_temp_ts("mockProjects", items)
            try:
                processed = cmd._seed_projects(tmp, org) or 0
            finally:
                tmp.unlink(missing_ok=True)
            created = Project.objects.filter(organization=org).count() - before
            reporter.add("projects", "created", max(created, 0))
            reporter.add("projects", "updated", max(processed - max(created, 0), 0))

        project_code_to_org_code: dict[str, str] = {}
        for project in Project.objects.filter(organization__in=org_by_code.values()):
            project_code_to_org_code.setdefault(project.code, project.organization.code)

        task_code_to_project_code: dict[str, str] = {}
        for item in self._load(mock_root, "tasks"):
            if item.get("code") and item.get("project_code"):
                task_code_to_project_code.setdefault(item["code"], item["project_code"])

        # Timelog idempotency: get_or_create has no DB uniqueness, so drop
        # items that already exist (task, person, date, duration).
        timelog_existing = self._timelog_key_set(org_by_code)

        jobs = [
            ("sequences", "_seed_sequences", "project_code", None, Sequence,
             lambda org, project, item: {"project": project, "code": item.get("code")}),
            ("shots", "_seed_shots", "project_code", None, Shot,
             lambda org, project, item: {"project": project, "code": item.get("code")}),
            ("assets", "_seed_assets", "project_code", None, Asset,
             lambda org, project, item: {"project": project, "code": item.get("code")}),
            ("tasks", "_seed_tasks", "project_code", None, Task,
             lambda org, project, item: {"project": project, "code": item.get("code")}),
            ("timelogs", "_seed_timelogs", None, "task_code", None, None),
            ("versions", "_seed_versions", "project_code", None, Version,
             lambda org, project, item: {"project": project, "code": item.get("code")}),
            ("reviews", "_seed_reviews", "project_code", None, Review,
             lambda org, project, item: {"organization": org, "code": item.get("code")}),
            ("playlists", "_seed_playlists", "project_code", None, Playlist,
             lambda org, project, item: {"organization": org, "code": item.get("code")}),
            ("media", "_seed_media", "project_code", None, Media,
             lambda org, project, item: {
                 "organization": org, "project": project,
                 "entity_type": item.get("entity_type", ""),
                 "entity_id": item.get("entity_id", ""),
                 "media_type": item.get("media_type", "image")}),
            ("workflows", "_seed_workflows", "project_code", None, Workflow,
             lambda org, project, item: {"organization": org, "code": item.get("code")}),
        ]
        # Known mock inconsistency (frontend file untouched): sequences.ts
        # references project "VEL1", which does not exist; intent is VEL01.
        code_fixes = {"VEL1": "VEL01"}
        for key, method, project_key, task_key, model, key_fn in jobs:
            items = self._load(mock_root, key)
            grouped: dict[str, list[dict[str, Any]]] = {}
            for item in items:
                if task_key:
                    proj_code = task_code_to_project_code.get(item.get(task_key, ""))
                else:
                    proj_code = item.get(project_key or "", "")
                proj_code = code_fixes.get(proj_code or "", proj_code)
                org_code = project_code_to_org_code.get(proj_code or "")
                org = org_by_code.get(org_code or "")
                if org is None:
                    reporter.add(key, "skipped")
                    continue
                self._rewrite_user_ids(item, id_to_email)
                if key == "timelogs" and self._timelog_key(item) in timelog_existing:
                    reporter.add(key, "existing")
                    continue
                if model is not None and key_fn is not None:
                    project = self._resolve_project(org, proj_code)
                    if project is None:
                        reporter.add(key, "skipped")
                        continue
                    self._restore_matching(model, key_fn(org, project, item), reporter, key)
                grouped.setdefault(org.code, []).append(item)
            total_processed = 0
            for org_code, group in grouped.items():
                model_cls = stats_models[key]
                before = model_cls.objects.filter(
                    organization=org_by_code[org_code]
                ).count()
                tmp = self._write_temp_ts(REACT_MOCK_FILES[key][1], group)
                try:
                    processed = getattr(cmd, method)(tmp, org_by_code[org_code]) or 0
                finally:
                    tmp.unlink(missing_ok=True)
                total_processed += processed
                if processed == 0 and group:
                    # Legacy seeders skip silently (missing tasks/users); say so.
                    reporter.note(
                        key,
                        f"0 of {len(group)} item(s) processed — "
                        "check linked tasks/users exist",
                    )
                after = model_cls.objects.filter(
                    organization=org_by_code[org_code]
                ).count()
                created = max(after - before, 0)
                reporter.add(key, "created", created)
                reporter.add(key, "updated", max(processed - created, 0))
        # Apply mock is_deleted flags as soft-deleted restore fixtures (§25).
        self._apply_mock_deletions(mock_root, reporter, org_by_code)

    def _resolve_project(self, org, project_code):
        from apps.production.models import Project

        if not project_code:
            return None
        return Project.objects.filter(
            organization=org, code=project_code
        ).first()

    def _timelog_key_set(self, org_by_code):
        from django.contrib.auth import get_user_model

        from apps.production.models import Project, Task, Timelog

        user_model = get_user_model()
        email_to_id = {
            str(getattr(u, "email", "")).lower(): str(getattr(u, "id", ""))
            for u in user_model.objects.all()
        }
        task_map = {}
        for task in Task.objects.filter(organization__in=org_by_code.values()):
            task_map.setdefault(task.code, task)
        project_by_id = {str(p.id): p for p in Project.objects.all()}
        keys = set()
        for row in Timelog.objects.filter(
            organization__in=org_by_code.values()
        ).values("task_id", "person_id", "date", "duration_hours"):
            keys.add((
                str(row["task_id"]),
                str(row["person_id"]),
                str(row["date"]),
                float(row["duration_hours"] or 0),
            ))
        # Remember maps for item-side matching.
        self._timelog_task_map = {
            code: str(task.id) for code, task in task_map.items()
        }
        self._timelog_email_to_id = email_to_id
        void = project_by_id  # keep linters calm about breadth; unused
        del void
        return keys

    def _timelog_key(self, item):
        task_id = self._timelog_task_map.get(item.get("task_code", ""), "")
        person_ref = item.get("person_id", "")
        if isinstance(person_ref, str) and "@" not in person_ref:
            person_id = person_ref  # already rewritten to email below
        else:
            person_id = person_ref
        person_id = self._timelog_email_to_id.get(str(person_id).lower(), str(person_id))
        date_val = item.get("date") or item.get("date_logged", "")
        try:
            hours = float(item.get("duration_hours", 0) or 0)
        except (TypeError, ValueError):
            hours = 0.0
        return (str(task_id), str(person_id), str(date_val), hours)

    def _apply_mock_deletions(self, mock_root, reporter, org_by_code):
        """Preserve mock is_deleted rows as soft-deleted restore fixtures."""
        from django.utils import timezone

        from apps.production.models import Sequence, Shot

        code_to_project = {}
        for project in __import__(
            "apps.production.models", fromlist=["Project"]
        ).Project.objects.filter(organization__in=org_by_code.values()):
            code_to_project.setdefault(project.code, project)
        for key, model in (("sequences", Sequence), ("shots", Shot)):
            for item in self._load(mock_root, key):
                if not item.get("is_deleted"):
                    continue
                project = code_to_project.get(item.get("project_code", ""))
                if project is None or not item.get("code"):
                    continue
                updated = model.objects.filter(
                    organization=project.organization,
                    project=project,
                    code=item["code"],
                    is_deleted=False,
                ).update(is_deleted=True, deleted_at=timezone.now(), status="Archived")
                if updated:
                    reporter.add(f"{key}_archived", "updated", updated)

    # ------------------------------------------------------------------
    # Phase: access (users + memberships from mock, never blanket grants)
    # ------------------------------------------------------------------

    def _resolve_role(self, role_name, reporter):
        from apps.organization.models import Permission, Role, RolePermission

        if not role_name:
            return Role.objects.filter(code="artist").first() or Role.objects.first()
        mapped_code = ROLE_NAME_MAP.get(role_name.strip())
        if mapped_code:
            role = Role.objects.filter(code=mapped_code).first()
            if role is not None:
                return role
        slug = "".join(
            c if c.isalnum() else "-" for c in role_name.strip().lower()
        ).strip("-")[:90] or "member"
        while "--" in slug:
            slug = slug.replace("--", "-")
        role = Role.objects.filter(code=slug).first()
        if role is not None:
            return role
        display, perm_codes = SUPPLEMENTAL_ROLES.get(slug, (role_name.strip(), []))
        perms = Permission.objects.filter(code__in=perm_codes)
        role = Role.objects.create(
            code=slug,
            name=display,
            description=f"Supplemental seed role for mock '{role_name}'",
            is_system=False,
            is_active=True,
        )
        for perm in perms:
            RolePermission.objects.get_or_create(
                role=role, permission=perm, defaults={"granted": True}
            )
        reporter.add("roles", "created")
        return role

    def _seed_overlay_access_users(self, mock_root, reporter, org_by_code=None):
        """Supplemental accounts + mock-driven org memberships (no blanket grants)."""
        from django.contrib.auth import get_user_model

        from apps.identity.models import Profile
        from apps.organization.models import OrganizationMembership

        if org_by_code is None:
            org_by_code = self._seed_overlay_orgs(mock_root, reporter)
        mock_orgs = self._load(mock_root, "organizations")
        mock_users = self._load(mock_root, "users")
        mock_org_id_to_code = {
            item.get("id"): (item.get("code") or "").strip().upper()
            for item in mock_orgs
            if item.get("id")
        }
        user_model = get_user_model()

        # Every mock user gets a Django account (seed_dev covers 4).
        for mock_user in mock_users:
            email = (mock_user.get("email") or "").lower()
            if not email or "@" not in email:
                reporter.add("users", "skipped")
                continue
            user, created = user_model.objects.get_or_create(
                email=email,
                defaults={"is_active": True, "is_staff": False, "is_superuser": False},
            )
            if created:
                user.set_password("password123")
                user.save(update_fields=["password"])
                reporter.add("users", "created")
            else:
                reporter.add("users", "existing")
            first = mock_user.get("first_name") or ""
            last = mock_user.get("last_name") or ""
            if not first and mock_user.get("full_name"):
                parts = mock_user["full_name"].split()
                first, last = parts[0], " ".join(parts[1:])
            _, profile_created = Profile.objects.get_or_create(
                user=user,
                defaults={
                    "first_name": first,
                    "last_name": last,
                    "display_name": mock_user.get("full_name") or f"{first} {last}".strip(),
                    "timezone": "Asia/Kolkata",
                    "language": "en",
                },
            )
            if profile_created:
                reporter.add("profiles", "created")

        # Org memberships strictly from mock (reconcile role to mock value).
        email_to_user = {
            str(getattr(u, "email", "")).lower(): u
            for u in user_model.objects.all()
        }
        for mock_user in mock_users:
            user = email_to_user.get((mock_user.get("email") or "").lower())
            if user is None:
                continue
            for membership in mock_user.get("memberships") or []:
                org = org_by_code.get(
                    mock_org_id_to_code.get(membership.get("organization_id"), "")
                )
                if org is None:
                    reporter.add("organization_memberships", "skipped")
                    continue
                role = self._resolve_role(membership.get("role"), reporter)
                if role is None:
                    reporter.add("organization_memberships", "skipped")
                    continue
                _, created = OrganizationMembership.objects.get_or_create(
                    user=user,
                    organization=org,
                    defaults={"role": role, "status": "active"},
                )
                if created:
                    reporter.add("organization_memberships", "created")
                else:
                    OrganizationMembership.objects.filter(
                        user=user, organization=org
                    ).update(role=role, status="active")
                    reporter.add("organization_memberships", "updated")

        return mock_users

    def _seed_overlay_access_projects(self, mock_root, reporter):
        """Project memberships from mock (email-matched users only)."""
        mock_users = self._load(mock_root, "users")
        reporter.rows.setdefault(
            "project_memberships", dict.fromkeys(SeedReporter.OUTCOMES, 0)
        )
        return self._seed_project_memberships(
            mock_root, mock_users, reporter=reporter
        )

    def _seed_project_memberships(self, mock_root, mock_users, reporter=None):
        from django.contrib.auth import get_user_model

        from apps.production.models import Project
        from apps.production.services.project_scoped import ProjectMembershipService

        user_model = get_user_model()
        email_to_user = {
            str(getattr(user, "email", "")).lower(): user
            for user in user_model.objects.filter(email__icontains="@")
        }
        projects = self._load(mock_root, "projects")
        code_to_project = {p.code: p for p in Project.objects.all()}
        id_to_project = {}
        for item in projects:
            project = code_to_project.get((item.get("code") or "").strip().upper())
            if project is not None and item.get("id"):
                id_to_project[item["id"]] = project

        created = 0
        for mock_user in mock_users:
            user = email_to_user.get((mock_user.get("email") or "").lower())
            if user is None:
                if reporter is not None:
                    reporter.add("project_memberships", "skipped")
                continue
            for pm in mock_user.get("project_memberships") or []:
                project = id_to_project.get(
                    pm.get("projectId") or pm.get("project_id") or ""
                )
                if project is None:
                    if reporter is not None:
                        reporter.add("project_memberships", "skipped")
                    continue
                roles = pm.get("roles") or [pm.get("role") or "Artist"]
                _, was_created = ProjectMembershipService.add_member(
                    organization=project.organization,
                    project=project,
                    user=user,
                    role=pm.get("role") or "Artist",
                    roles=roles,
                    scope=pm.get("scope") or "PROJECT",
                    vendor_id=pm.get("vendor_id", ""),
                    client_id=pm.get("client_id", ""),
                    team_id=pm.get("team_id", ""),
                    department_id=pm.get("department_id", ""),
                )
                created += int(was_created)
                if reporter is not None and not was_created:
                    reporter.add("project_memberships", "existing")
        if reporter is not None:
            reporter.add("project_memberships", "created", created)
        return created

    # ------------------------------------------------------------------
    # Phase: content (editorial, notes, activity linkage)
    # ------------------------------------------------------------------

    def _seed_overlay_content(self, mock_root, reporter):
        from apps.production.models import EditorialCut, Project, ProjectNote

        code_to_project = {}
        for project in Project.objects.select_related("organization").all():
            code_to_project.setdefault(project.code, project)

        id_to_email = {}
        for item in self._load(mock_root, "users"):
            if item.get("id") and item.get("email"):
                id_to_email[item["id"]] = item["email"]

        for item in self._load(mock_root, "editorial"):
            project = code_to_project.get((item.get("project_code") or "").upper())
            if project is None or not item.get("code"):
                reporter.add("editorial", "skipped")
                continue
            self._restore_matching(
                EditorialCut,
                {"organization": project.organization, "project": project,
                 "code": item["code"]},
                reporter,
                "editorial",
            )
            _, was_created = EditorialCut.objects.update_or_create(
                organization=project.organization,
                project=project,
                code=item["code"],
                defaults={
                    "sequence_code": item.get("sequence_code", ""),
                    "name": item.get("name", item["code"]),
                    "cut_type": item.get("cut_type", "Turnover"),
                    "version": item.get("version", ""),
                    "fps": item.get("fps", 24) or 24,
                    "duration_frames": item.get("duration_frames", 0) or 0,
                    "duration_tc": item.get("duration_tc", ""),
                    "start_tc": item.get("start_tc", ""),
                    "end_tc": item.get("end_tc", ""),
                    "source_edl_filename": item.get("source_edl_filename", ""),
                    "xml_manifest_url": item.get("xml_manifest_url", ""),
                    "total_shots_in_cut": item.get("total_shots_in_cut", 0) or 0,
                    "matched_vfx_shots": item.get("matched_vfx_shots", 0) or 0,
                    "unmatched_shots": item.get("unmatched_shots", 0) or 0,
                    "editorial_notes": item.get("editorial_notes", ""),
                    "editor_name": item.get("editor_name", ""),
                    "conformed_by": item.get("conformed_by", ""),
                    "status": item.get("status", "Not Started"),
                    "burn_in_lut": item.get("burn_in_lut", ""),
                    "thumbnail_url": item.get("thumbnail_url", ""),
                },
            )
            reporter.add("editorial", "created" if was_created else "updated")

        for item in self._load(mock_root, "notes"):
            project = code_to_project.get((item.get("project_code") or "").upper())
            if project is None or not item.get("subject"):
                reporter.add("notes", "skipped")
                continue
            lookup = {
                "organization": project.organization,
                "project": project,
                "subject": item.get("subject", ""),
                "entity_code": item.get("entity_code", ""),
            }
            self._restore_matching(ProjectNote, lookup, reporter, "notes")
            _, was_created = ProjectNote.objects.get_or_create(
                **lookup,
                defaults={
                    "entity_type": item.get("entity_type", "Project"),
                    "entity_id": item.get("entity_id", ""),
                    "entity_name": item.get("entity_name", ""),
                    "author_name": item.get("author_name", ""),
                    "author_avatar": item.get("author_avatar", ""),
                    "author_role": item.get("author_role", ""),
                    "body": item.get("body", ""),
                    "category": item.get("category", "General"),
                    "priority": item.get("priority", "Medium"),
                    "tags": item.get("tags", []),
                    "status": item.get("status", "Open"),
                    "timecode_ref": item.get("timecode_ref", ""),
                    "frame_number": item.get("frame_number"),
                },
            )
            reporter.add("notes", "created" if was_created else "existing")

        reporter.add("activity_links", "processed", self._link_activities())

    # ------------------------------------------------------------------
    # Activity linkage
    # ------------------------------------------------------------------

    def _link_activities(self):
        from apps.audit.models.activity import Activity
        from apps.production.models import Project

        projects = list(Project.objects.select_related("organization").all())
        by_code = {p.code.upper(): p for p in projects}
        by_name = {p.name.lower(): p for p in projects}

        linked = 0
        pending = Activity.objects.filter(
            metadata__has_key="entity"
        ).exclude(metadata__has_key="project_id")
        for activity in pending.iterator():
            entity = (activity.metadata or {}).get("entity") or {}
            project = self._match_project(
                entity, by_code, by_name, activity.organization_id
            )
            if project is None:
                continue
            metadata = dict(activity.metadata or {})
            metadata["project_id"] = str(project.id)
            metadata["project_code"] = project.code
            Activity.objects.filter(pk=activity.pk).update(metadata=metadata)
            linked += 1
        return linked

    @staticmethod
    def _match_project(entity, by_code, by_name, organization_id):
        candidates = [
            entity.get("id"),
            entity.get("code"),
            entity.get("name"),
            entity.get("context"),
        ]
        for candidate in candidates:
            if not candidate or not isinstance(candidate, str):
                continue
            project = by_code.get(candidate.strip().upper())
            if project is not None and (
                organization_id is None or project.organization_id == organization_id
            ):
                return project
            lowered = candidate.strip().lower()
            for name, project in by_name.items():
                if (lowered in name or name in lowered) and (
                    organization_id is None
                    or project.organization_id == organization_id
                ):
                    return project
        return None

    # ------------------------------------------------------------------
    # Validation (§18, §19): fail on critical violations
    # ------------------------------------------------------------------

    def _validate(self, reporter):
        from django.db import models

        from apps.deliveries.models import DeliveryPackage
        from apps.organization.models import (
            Organization,
            OrganizationMembership,
            Permission,
        )
        from apps.production.models import (
            Asset,
            EditorialCut,
            Media,
            Playlist,
            Project,
            ProjectMembership,
            ProjectNote,
            Review,
            Sequence,
            Shot,
            Task,
            Version,
            Workflow,
        )
        try:
            from apps.publishing.models import PublishItem
        except Exception:  # noqa: BLE001
            PublishItem = None

        criticals = 0

        def critical(entity, message):
            nonlocal criticals
            criticals += 1
            reporter.error(entity, f"CRITICAL: {message}")

        def warn(entity, message):
            reporter.error(entity, f"warning: {message}")

        scoped: list[tuple[str, Any]] = [
            ("sequences", Sequence),
            ("shots", Shot),
            ("assets", Asset),
            ("tasks", Task),
            ("versions", Version),
            ("reviews", Review),
            ("media", Media),
            ("playlists", Playlist),
            ("workflows", Workflow),
            ("notes", ProjectNote),
            ("editorial", EditorialCut),
            ("deliveries", DeliveryPackage),
        ]
        if PublishItem is not None:
            scoped.append(("publishes", PublishItem))
        for entity, model in scoped:
            # Compare org ownership row by row (works across backends).
            mismatched = 0
            for row in model.objects.select_related("organization", "project").only(
                "id", "organization_id", "project__organization_id"
            ).iterator():
                if row.project_id and row.organization_id != row.project.organization_id:
                    mismatched += 1
            if mismatched:
                critical(entity, f"{mismatched} row(s) with project in another organization")

        # Project memberships must live in their project's organization.
        pm_bad = 0
        for row in ProjectMembership.objects.select_related(
            "organization", "project__organization"
        ).only("id", "organization_id", "project__organization_id").iterator():
            if row.organization_id != row.project.organization_id:
                pm_bad += 1
        if pm_bad:
            critical("project_memberships", f"{pm_bad} row(s) outside their project organization")

        # Org memberships must reference existing users/orgs (FKs guarantee it;
        # check soft-deleted users still holding active memberships).
        stale = OrganizationMembership.objects.filter(
            user__is_active=False, status="active"
        ).count()
        if stale:
            warn("organization_memberships", f"{stale} active membership(s) for inactive users")

        # Duplicate natural keys where uniqueness is expected.
        for entity, model, fields in [
            ("projects", Project, ["organization", "code"]),
            ("sequences", Sequence, ["project", "code"]),
            ("shots", Shot, ["project", "code"]),
            ("assets", Asset, ["project", "code"]),
            ("tasks", Task, ["project", "code"]),
        ]:
            dupes = (
                model.all_objects.values(*fields)
                .annotate(n=models.Count("id"))
                .filter(n__gt=1)
                .count()
            )
            if dupes:
                critical(entity, f"{dupes} duplicate natural key(s)")

        # Permission catalog coverage vs frontend-checked codes.
        catalog = set(
            Permission.objects.filter(is_active=True).values_list("code", flat=True)
        )
        missing = [code for code in FRONTEND_PERMISSION_CODES if code not in catalog]
        if missing:
            warn("permissions", f"frontend-checked codes missing: {sorted(missing)}")

        # Users without any membership cannot use anything.
        from django.contrib.auth import get_user_model

        user_model = get_user_model()
        member_ids = set(
            OrganizationMembership.objects.values_list("user_id", flat=True)
        )
        homeless = user_model.objects.exclude(id__in=member_ids).count()
        if homeless:
            warn("users", f"{homeless} user(s) without organization membership")

        # Orgs without projects cannot demo anything.
        for org in Organization.objects.all():
            if not Project.objects.filter(organization=org).exists():
                warn("organizations", f"{org.code} has no projects")

        # Restore fixtures present (info-level honesty).
        archived = Sequence.objects.filter(is_deleted=True).count() + Shot.objects.filter(
            is_deleted=True
        ).count()
        reporter.add("validation", "processed", archived)
        return criticals
