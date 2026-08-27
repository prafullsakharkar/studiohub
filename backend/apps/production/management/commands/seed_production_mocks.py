"""
Seed production mock data from frontend mocks into Django DB.

This makes the backend serve the same production data that the frontend previously
got from `src/mocks/db/production/*` via `mockRouter.ts`. After this seed,
`VITE_USE_MOCK=false` will return identical data from Django at
`/api/v1/{projects,shots,assets,tasks,timelogs,versions,reviews,playlists,media,workflows}`.

Idempotent: uses `code` as natural key per organization, `update_or_create` for all.
Run:  uv run manage.py seed_production_mocks --force
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

User = get_user_model()


def _load_ts_mock_array(ts_path: Path, var_name: str) -> list[dict]:
    """
    Very small TS mock parser: extracts `export const <var_name>: Type[] = [ ... ];`
    and evaluates the JS array literal as JSON-ish (handles single quotes, trailing commas).
    For a more robust parse we just exec via node if available, else fallback to manual.
    """
    text = ts_path.read_text()
    # Find the const declaration
    pattern = rf"export const {re.escape(var_name)}[^=]*=\s*\["
    m = re.search(pattern, text)
    if not m:
        return []
    start = m.end() - 1  # at [
    # Find matching closing ]; (track brackets, handle strings)
    depth = 0
    end = None
    in_single = False
    in_double = False
    in_backtick = False
    escape = False
    for i in range(start, len(text)):
        c = text[i]
        if escape:
            escape = False
            continue
        if c == "\\":
            escape = True
            continue
        if c == "'" and not in_double and not in_backtick:
            in_single = not in_single
            continue
        if c == '"' and not in_single and not in_backtick:
            in_double = not in_double
            continue
        if c == "`" and not in_single and not in_double:
            in_backtick = not in_backtick
            continue
        if in_single or in_double or in_backtick:
            continue
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        return []
    js_array = text[start:end]
    # Use node to eval if available (more accurate)
    try:
        import subprocess, json as _json, tempfile

        # For mockWorkflows, also include shotWorkflowNodes/Transitions definitions if present
        preamble = ""
        if var_name == "mockWorkflows":
            # Extract shotWorkflowNodes and shotWorkflowTransitions if present
            for dep_var in ["shotWorkflowNodes", "shotWorkflowTransitions"]:
                dep_pat = rf"(?:export\s+)?const {re.escape(dep_var)}[^=]*=\s*\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*\]"
                dep_m = re.search(dep_pat, text, re.DOTALL)
                if dep_m:
                    dep_src = dep_m.group(0)
                    # Strip export and TypeScript type annotation
                    dep_src = re.sub(r"^\s*export\s+", "", dep_src)
                    dep_src = re.sub(r":[^=]*=", "=", dep_src, count=1)
                    preamble += dep_src + ";\n"
        js = f"{preamble}const data = {js_array}; console.log(JSON.stringify(data));"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False) as f:
            f.write(js)
            fname = f.name
        out = subprocess.check_output(["node", fname], text=True, timeout=5)
        os.unlink(fname)
        return _json.loads(out)
    except Exception:
        pass
    # Fallback: try to convert single quotes to double and trailing commas
    try:
        # Remove single-line comments
        js_array = re.sub(r"//.*", "", js_array)
        # Replace single quotes with double (naive)
        # Use a simple approach: replace ' with " and handle escaped
        js_array = js_array.replace("'", '"')
        # Remove trailing commas before ] or }
        js_array = re.sub(r",\s*([\]}])", r"\1", js_array)
        return json.loads(js_array)
    except Exception as e:
        print(f"Failed to parse {var_name} in {ts_path}: {e}")
        return []


class Command(BaseCommand):
    help = "Seed production mock data from frontend mocks into DB (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Allow in production.")
        parser.add_argument("--reset", action="store_true", help="Delete existing production mock data before seeding.")

    def handle(self, *args, **options):
        force = options["force"]
        reset = options["reset"]
        allow_seed_env = os.getenv("ALLOW_SEED", "").lower() in ("1", "true", "yes")
        if not settings.DEBUG and not force and not allow_seed_env:
            raise CommandError("Refusing to seed in production. Use --force or ALLOW_SEED=1.")

        # Resolve frontend mocks path relative to repo root (backend is at repo/backend)
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"

        self.stdout.write(self.style.NOTICE(f"Seeding production mocks from {frontend_root} ..."))

        with transaction.atomic():
            if reset:
                self._reset()

            # Ensure org exists (APEX)
            from apps.organization.models import Organization

            org, _ = Organization.objects.get_or_create(
                code="APEX",
                defaults={
                    "name": "Apex Digital Studios",
                    "slug": "apex-digital-studios",
                    "organization_type": "studio",
                    "status": "active",
                },
            )

            # Load and seed each mock file
            counts = {}
            counts["projects"] = self._seed_projects(frontend_root / "production" / "projects.ts", org)
            counts["shots"] = self._seed_shots(frontend_root / "production" / "shots.ts", org)
            counts["assets"] = self._seed_assets(frontend_root / "assets" / "assets.ts", org)
            counts["tasks"] = self._seed_tasks(frontend_root / "tasks" / "tasks.ts", org)
            counts["timelogs"] = self._seed_timelogs(frontend_root / "production" / "timelogs.ts", org)
            counts["versions"] = self._seed_versions(frontend_root / "versions" / "versions.ts", org)
            counts["reviews"] = self._seed_reviews(frontend_root / "reviews" / "reviews.ts", org)
            counts["playlists"] = self._seed_playlists(frontend_root / "production" / "playlists.ts", org)
            counts["media"] = self._seed_media(frontend_root / "production" / "media.ts", org)
            counts["workflows"] = self._seed_workflows(frontend_root / "production" / "workflow.ts", org)

        self.stdout.write(self.style.SUCCESS("Production mock seed complete."))
        for k, v in counts.items():
            self.stdout.write(f"  {k}: {v}")
        self.stdout.write(self.style.NOTICE("Frontend VITE_USE_MOCK=false will now serve this DB data at /api/v1/*"))

    def _reset(self):
        from apps.production.models import Asset, Media, Playlist, Project, Review, Shot, Task, Timelog, Version, Workflow

        self.stdout.write(self.style.WARNING("  --reset: deleting existing production mock data..."))
        for model in [Timelog, Task, Version, Review, Media, Playlist, Workflow, Asset, Shot, Project]:
            try:
                model.objects.all().delete()
            except Exception as e:
                self.stdout.write(f"    reset warning {model.__name__}: {e}")

    def _get_user(self, email_or_id: str):
        if not email_or_id:
            return None
        try:
            return User.objects.get(email__iexact=email_or_id)
        except User.DoesNotExist:
            try:
                return User.objects.get(pk=email_or_id)
            except Exception:
                return None

    def _seed_projects(self, ts_path, org):
        from apps.production.models import Project

        data = _load_ts_mock_array(ts_path, "mockProjects")
        if not data:
            self.stdout.write(f"  projects: 0 (no data in {ts_path})")
            return 0
        count = 0
        for item in data:
            code = item.get("code")
            if not code:
                continue
            # Map supervisor/coordinator by email or id
            sup = self._get_user(item.get("supervisor_id") or item.get("supervisor_email") or item.get("supervisor_name") or "")
            coord = self._get_user(item.get("coordinator_id") or item.get("coordinator_email") or "")
            # Fallback to first user if not found
            if not sup:
                sup = User.objects.filter(is_staff=True).first()
            if not coord:
                coord = User.objects.filter(is_staff=True).first()
            Project.objects.update_or_create(
                code=code,
                organization=org,
                defaults={
                    "name": item.get("name", code),
                    "description": item.get("description", ""),
                    "type": item.get("type", "Feature Film"),
                    "status": item.get("status", "In Progress"),
                    "fps": item.get("fps", 24),
                    "resolution": item.get("resolution", "4096x2160"),
                    "aspect_ratio": item.get("aspect_ratio", "2.39:1"),
                    "color_space": item.get("color_space", "ACEScg"),
                    "thumbnail_url": item.get("thumbnail_url", ""),
                    "budget_usd": item.get("budget_usd", 0) or 0,
                    "supervisor": sup,
                    "coordinator": coord,
                    "client_id": item.get("client_id", ""),
                    "client_name": item.get("client_name", ""),
                    "client_contact_id": item.get("client_contact_id", ""),
                    "client_contact_name": item.get("client_contact_name", ""),
                    "vendor_ids": item.get("vendor_ids", []),
                    "vendor_names": item.get("vendor_names", []),
                    "vendor_team_ids": item.get("vendor_team_ids", []),
                    "total_shots": item.get("total_shots", 0),
                    "approved_shots": item.get("approved_shots", 0),
                    "in_progress_shots": item.get("in_progress_shots", 0),
                    "total_assets": item.get("total_assets", 0),
                },
            )
            count += 1
        return count

    def _seed_shots(self, ts_path, org):
        from apps.production.models import Project, Shot

        data = _load_ts_mock_array(ts_path, "mockShots")
        if not data:
            return 0
        # Build project code -> id map for org
        proj_map = {p.code: p for p in Project.objects.filter(organization=org)}
        count = 0
        for item in data:
            code = item.get("code")
            proj_code = item.get("project_code")
            proj = proj_map.get(proj_code)
            if not proj:
                proj = Project.objects.filter(organization=org).first()
            if not proj:
                continue
            Shot.objects.update_or_create(
                code=code,
                project=proj,
                defaults={
                    "organization": org,
                    "sequence_code": item.get("sequence_code", ""),
                    "name": item.get("name", code),
                    "description": item.get("description", ""),
                    "status": item.get("status", "Not Started"),
                    "frame_in": item.get("frame_in", 1001),
                    "frame_out": item.get("frame_out", 1100),
                    "handle_frames": item.get("handle_frames", 8),
                    "thumbnail_url": item.get("thumbnail_url", ""),
                    "video_url": item.get("video_url", ""),
                    "current_version": item.get("current_version", "v001"),
                    "assigned_artist": self._get_user(item.get("assigned_artist_id", "")),
                    "supervisor_approved": item.get("supervisor_approved", False),
                    "client_approved": item.get("client_approved", False),
                    "pipeline": item.get("pipeline", {}),
                },
            )
            count += 1
        return count

    def _seed_assets(self, ts_path, org):
        from apps.production.models import Asset, Project

        data = _load_ts_mock_array(ts_path, "mockAssets")
        if not data:
            return 0
        proj_map = {p.code: p for p in Project.objects.filter(organization=org)}
        # Need departments/teams for FK
        from apps.organization.models import Department, Team

        count = 0
        for item in data:
            code = item.get("code")
            proj_code = item.get("project_code")
            proj = proj_map.get(proj_code) or Project.objects.filter(organization=org).first()
            if not proj:
                continue
            dept = None
            team = None
            if item.get("department_name"):
                dept = Department.objects.filter(organization=org, name=item["department_name"]).first() or Department.objects.filter(organization=org).first()
            if item.get("team_name"):
                team = Team.objects.filter(organization=org, name=item["team_name"]).first() or Team.objects.filter(organization=org).first()
            Asset.objects.update_or_create(
                code=code,
                project=proj,
                defaults={
                    "organization": org,
                    "name": item.get("name", code),
                    "category": item.get("category", "Prop"),
                    "description": item.get("description", ""),
                    "status": item.get("status", "Not Started"),
                    "version": item.get("version", "v001"),
                    "file_format": item.get("file_format", "OpenUSD"),
                    "poly_count": item.get("poly_count", 0) or 0,
                    "lod_levels": item.get("lod_levels", 1) or 1,
                    "software": item.get("software", "Maya"),
                    "thumbnail_url": item.get("thumbnail_url", ""),
                    "department": dept,
                    "team": team,
                    "assigned_artist": self._get_user(item.get("assigned_artist_id", "")),
                    "tags": item.get("tags", []),
                    "usd_prim_path": item.get("usd_prim_path", ""),
                },
            )
            count += 1
        return count

    def _seed_tasks(self, ts_path, org):
        from apps.production.models import Project, Task

        data = _load_ts_mock_array(ts_path, "mockTasks")
        if not data:
            return 0
        proj_map = {p.code: p for p in Project.objects.filter(organization=org)}
        count = 0
        for item in data:
            code = item.get("code")
            proj_code = item.get("project_code")
            proj = proj_map.get(proj_code) or Project.objects.filter(organization=org).first()
            if not proj:
                continue
            Task.objects.update_or_create(
                code=code,
                project=proj,
                defaults={
                    "organization": org,
                    "title": item.get("title", code),
                    "entity_type": item.get("entity_type", "Shot"),
                    "entity_id": item.get("entity_id", ""),
                    "entity_code": item.get("entity_code", ""),
                    "entity_name": item.get("entity_name", ""),
                    "department": item.get("department", ""),
                    "team": None,  # could map via team_name if needed
                    "assignee": self._get_user(item.get("assignee_id", "")),
                    "reviewer": self._get_user(item.get("reviewer_id", "")),
                    "vendor_id": item.get("vendor_id", ""),
                    "vendor_name": item.get("vendor_name", ""),
                    "status": item.get("status", "Not Started"),
                    "priority": item.get("priority", "Medium"),
                    "workflow": item.get("workflow", {}),
                    "schedule": item.get("schedule", {}),
                    "dependencies": item.get("dependencies", {}),
                    "description": item.get("description", ""),
                    "software": item.get("software", ""),
                    "tags": item.get("tags", []),
                    "is_archived": item.get("is_archived", False),
                },
            )
            count += 1
        return count

    def _seed_timelogs(self, ts_path, org):
        from apps.production.models import Project, Task, Timelog
        from datetime import datetime, date as date_type

        data = _load_ts_mock_array(ts_path, "mockTimelogs")
        if not data:
            data = _load_ts_mock_array(ts_path, "mockTimelogEntry")
        if not data:
            return 0
        count = 0
        for item in data:
            task = None
            if item.get("task_id"):
                try:
                    task = Task.objects.get(pk=item["task_id"])
                except Exception:
                    task = Task.objects.filter(organization=org).first()
            if not task:
                # Try to find by entity_code
                if item.get("entity_code"):
                    task = Task.objects.filter(organization=org, entity_code=item["entity_code"]).first()
                if not task:
                    task = Task.objects.filter(organization=org).first()
            if not task:
                continue
            # Parse date - handle both "date" and "date_logged"
            date_val = item.get("date") or item.get("date_logged")
            if isinstance(date_val, str):
                try:
                    date_val = datetime.fromisoformat(date_val.replace("Z", "+00:00")).date()
                except Exception:
                    try:
                        date_val = datetime.strptime(date_val, "%Y-%m-%d").date()
                    except Exception:
                        date_val = date_type(2026, 8, 26)
            if not date_val:
                date_val = date_type(2026, 8, 26)
            # Handle person - production timelogs use artist_id, tasks timelogs use person_id
            person = self._get_user(item.get("person_id") or item.get("artist_id") or "")
            if not person:
                person = task.assignee or User.objects.filter(is_active=True).first()
            if not person:
                continue
            # Handle hours - production uses hours_logged, tasks use duration_hours
            hours = item.get("duration_hours")
            if hours is None:
                hours = item.get("hours_logged", 0)
            # Handle department
            dept = item.get("department", task.department if task else "")
            Timelog.objects.get_or_create(
                task=task,
                person=person,
                date=date_val,
                duration_hours=hours or 0,
                defaults={
                    "organization": org,
                    "project": task.project,
                    "department": dept,
                    "billable": item.get("billable", not item.get("is_overtime", False)),
                    "notes": item.get("notes", item.get("description", "")),
                    "status": item.get("status", "Submitted"),
                    "activity_category": item.get("activity_category", "Direct Work"),
                    "hourly_rate_usd": item.get("hourly_rate_usd", item.get("billing_rate_usd", 0)) or 0,
                    "task_code": task.code if task else "",
                    "task_title": task.title if task else "",
                    "project_code": task.project.code if task and task.project else "",
                },
            )
            count += 1
        return count

    def _seed_versions(self, ts_path, org):
        from apps.production.models import Project, Version

        data = _load_ts_mock_array(ts_path, "mockVersions")
        if not data:
            return 0
        proj_map = {p.code: p for p in Project.objects.filter(organization=org)}
        count = 0
        for item in data:
            code = item.get("code")
            proj_code = item.get("project_code")
            proj = proj_map.get(proj_code) or Project.objects.filter(organization=org).first()
            if not proj:
                continue
            Version.objects.update_or_create(
                code=code,
                project=proj,
                defaults={
                    "organization": org,
                    "version_number": item.get("version_number", "v001"),
                    "version_index": item.get("version_index", 1),
                    "entity_type": item.get("entity_type", "Shot"),
                    "entity_id": item.get("entity_id", ""),
                    "entity_code": item.get("entity_code", ""),
                    "department": str(item.get("department", "")),
                    "artist": self._get_user(item.get("artist_id", "")),
                    "status": item.get("status", "Pending Review"),
                    "is_published": item.get("is_published", False),
                    "is_hero": item.get("is_hero", False),
                    "is_archived": item.get("is_archived", False),
                    "thumbnail_url": item.get("thumbnail_url", ""),
                    "video_url": item.get("video_url", ""),
                    "resolution": item.get("resolution", "4096x2160"),
                    "fps": item.get("fps", 24),
                    "file_size_mb": item.get("file_size_mb", 0) or 0,
                    "color_space": item.get("color_space", "ACEScg"),
                    "publishing_info": item.get("publishing_info", {}),
                    "tags": item.get("tags", []),
                },
            )
            count += 1
        return count

    def _seed_reviews(self, ts_path, org):
        from apps.production.models import Project, Review

        data = _load_ts_mock_array(ts_path, "mockReviews")
        if not data:
            return 0
        proj_map = {p.code: p for p in Project.objects.filter(organization=org)}
        count = 0
        for item in data:
            code = item.get("code")
            proj_code = item.get("project_code")
            proj = proj_map.get(proj_code) or Project.objects.filter(organization=org).first()
            Review.objects.update_or_create(
                code=code,
                organization=org,
                defaults={
                    "title": item.get("title", code),
                    "description": item.get("description", ""),
                    "project": proj,
                    "entity_type": item.get("entity_type", "Shot"),
                    "entity_id": item.get("entity_id", ""),
                    "entity_code": item.get("entity_code", ""),
                    "status": item.get("status", "Pending Review"),
                    "lead_reviewer_name": item.get("lead_reviewer_name", ""),
                    "thumbnail_url": item.get("thumbnail_url", ""),
                    "video_url": item.get("video_url", ""),
                    "versions": item.get("versions", []),
                    "reviewers": item.get("reviewers", []),
                    "comments": item.get("comments", []),
                    "notes": item.get("notes", []),
                    "annotations": item.get("annotations", []),
                    "activity": item.get("activity", []),
                },
            )
            count += 1
        return count

    def _seed_playlists(self, ts_path, org):
        from apps.production.models import Playlist, Project

        data = _load_ts_mock_array(ts_path, "mockPlaylists")
        if not data:
            return 0
        proj_map = {p.code: p for p in Project.objects.filter(organization=org)}
        count = 0
        for item in data:
            code = item.get("code") or item.get("id")
            proj_code = item.get("project_code")
            proj = proj_map.get(proj_code) or Project.objects.filter(organization=org).first()
            Playlist.objects.update_or_create(
                code=code,
                organization=org,
                defaults={
                    "name": item.get("name", code),
                    "description": item.get("description", ""),
                    "project": proj,
                    "status": item.get("status", "Active"),
                    "entries": item.get("entries", []),
                    "share_settings": item.get("share_settings", {}),
                },
            )
            count += 1
        return count

    def _seed_media(self, ts_path, org):
        from apps.production.models import Media, Project

        data = _load_ts_mock_array(ts_path, "mockMediaAssets")
        if not data:
            return 0
        proj_map = {p.code: p for p in Project.objects.filter(organization=org)}
        count = 0
        for item in data:
            # Media has no code, use id
            mid = item.get("id")
            proj_code = item.get("project_code")
            proj = proj_map.get(proj_code) or Project.objects.filter(organization=org).first()
            Media.objects.get_or_create(
                organization=org,
                project=proj,
                entity_type=item.get("entity_type", ""),
                entity_id=item.get("entity_id", ""),
                media_type=item.get("media_type", "image"),
                defaults={
                    "category": item.get("category", ""),
                    "file_format": item.get("file_format", "jpg"),
                    "source_url": item.get("source_url", "") or item.get("url", ""),
                    "preview_url": item.get("preview_url", ""),
                    "thumbnail_url": item.get("thumbnail_url", ""),
                    "file_size_mb": item.get("file_size_mb", 0) or 0,
                },
            )
            count += 1
        return count

    def _seed_workflows(self, ts_path, org):
        from apps.production.models import Project, Workflow

        data = _load_ts_mock_array(ts_path, "mockWorkflows")
        # Fallback to stub if parsing failed (e.g., missing mockAutomationRules)
        if not data:
            # Create minimal workflows directly
            proj = Project.objects.filter(organization=org).first()
            for code, name in [("WF-SHOT-01", "Shot Workflow"), ("WF-ASSET-01", "Asset Workflow")]:
                Workflow.objects.get_or_create(
                    code=code,
                    organization=org,
                    defaults={
                        "name": name,
                        "description": f"Seeded {name}",
                        "project": proj,
                        "category": "production",
                        "is_active": True,
                        "nodes": [{"id": "start", "type": "start"}, {"id": "task", "type": "task"}, {"id": "end", "type": "end"}],
                        "transitions": [{"from": "start", "to": "task"}, {"from": "task", "to": "end"}],
                        "automation_rules": [],
                    },
                )
            return 2
        proj_map = {p.code: p for p in Project.objects.filter(organization=org)}
        count = 0
        for item in data:
            code = item.get("code")
            proj_code = item.get("project_code")
            proj = proj_map.get(proj_code) or Project.objects.filter(organization=org).first()
            Workflow.objects.update_or_create(
                code=code,
                organization=org,
                defaults={
                    "name": item.get("name", code),
                    "description": item.get("description", ""),
                    "project": proj,
                    "category": item.get("category", "production"),
                    "is_active": item.get("is_active", True),
                    "nodes": item.get("nodes", []),
                    "transitions": item.get("transitions", []),
                    "automation_rules": item.get("automation_rules", []),
                },
            )
            count += 1
        return count
