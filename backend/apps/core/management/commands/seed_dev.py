"""
Seed development data for StudioHub.

Idempotent and env-gated: refuses to run in production unless --force is passed.
Safe to run repeatedly; uses get_or_create / update_or_create throughout.

Covers:
  - Organization (Apex Digital Studios)
  - Departments / Teams / Offices
  - Roles & Permissions (RBAC)
  - Users + Profiles + Memberships (admin@, supervisor@, lead@, artist@ with password123)

Usage:
  python manage.py seed_dev
  python manage.py seed_dev --force   # in production
  python manage.py seed_dev --reset  # delete and recreate (danger)

Relationships and constraints are respected; permissions and constraints remain intact.
"""

from __future__ import annotations

import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

User = get_user_model()


class Command(BaseCommand):
    help = "Seed development data (idempotent, dev-only)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow seeding even when DEBUG is False.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing seed data before seeding.",
        )

    def handle(self, *args, **options):
        force = options["force"]
        reset = options["reset"]

        # Env gate: only allow in DEBUG or when explicitly forced / ALLOW_SEED set.
        allow_seed_env = os.getenv("ALLOW_SEED", "").lower() in ("1", "true", "yes")
        if not settings.DEBUG and not force and not allow_seed_env:
            raise CommandError(
                "Refusing to seed in production. Use --force or set ALLOW_SEED=1 / DEBUG=True."
            )

        if reset and not force and not settings.DEBUG:
            raise CommandError(" --reset in production requires --force.")

        self.stdout.write(self.style.NOTICE("Seeding StudioHub development data..."))

        with transaction.atomic():
            if reset:
                self._reset()

            org = self._seed_organizations()
            departments = self._seed_departments(org)
            teams = self._seed_teams(org, departments)
            offices = self._seed_offices(org)
            perms = self._seed_permissions()
            roles = self._seed_roles(org, perms)
            users = self._seed_users(org, departments, teams, offices, roles)
            # Production seeding (idempotent)
            projects = self._seed_projects(org, users)
            shots = self._seed_shots(org, projects, users)
            assets = self._seed_assets(org, projects, users, departments, teams)
            tasks = self._seed_tasks(org, projects, shots, assets, users, departments, teams)
            timelogs = self._seed_timelogs(org, tasks, users)
            versions = self._seed_versions(org, projects, shots, assets, tasks, users)
            reviews = self._seed_reviews(org, projects, shots, versions, users)
            playlists = self._seed_playlists(org, projects, versions, reviews)
            media = self._seed_media(org, projects, shots, assets)
            workflows = self._seed_workflows(org, projects)

        self.stdout.write(self.style.SUCCESS("Seed complete."))
        self.stdout.write(f"  Organization: {org.code} ({org.name})")
        self.stdout.write(f"  Departments: {len(departments)}  Teams: {len(teams)}  Offices: {len(offices)}")
        self.stdout.write(f"  Roles: {len(roles)}  Permissions: {len(perms)}  Users: {len(users)}")
        self.stdout.write(f"  Projects: {len(projects)}  Shots: {len(shots)}  Assets: {len(assets)}")
        self.stdout.write(f"  Tasks: {len(tasks)}  Timelogs: {len(timelogs)}  Versions: {len(versions)}")
        self.stdout.write(f"  Reviews: {len(reviews)}  Playlists: {len(playlists)}  Media: {len(media)}  Workflows: {len(workflows)}")
        self.stdout.write(self.style.NOTICE("  Default password for seeded users: password123"))

    def _reset(self):
        from apps.organization.models import (
            Department,
            Office,
            Organization,
            Role,
            Team,
        )

        self.stdout.write(self.style.WARNING("  --reset: removing existing seed data..."))
        # Delete in dependency order
        User.objects.filter(email__in=self._seed_emails()).delete()
        Team.objects.filter(code__startswith="TEAM-").delete()
        Department.objects.filter(code__startswith="DEPT-").delete()
        Office.objects.filter(code__startswith="OFF-").delete()
        Role.objects.filter(code__in=[c for c, _ in self._seed_roles_spec()]).delete()
        Organization.objects.filter(code="APEX").delete()

    def _seed_emails(self):
        return [e for e, _ in self._seed_users_spec()]

    def _seed_organizations(self):
        from apps.organization.models import Organization

        org, created = Organization.objects.get_or_create(
            code="APEX",
            defaults={
                "name": "Apex Digital Studios",
                "slug": "apex-digital-studios",
                "organization_type": "studio",
                "email": "contact@apex-digital-studios.com",
                "country": "IN",
                "language": "en",
                "currency": "INR",
                "timezone": "Asia/Kolkata",
                "description": "Primary development organization seeded for local development.",
                "status": "active",
            },
        )
        if created:
            self.stdout.write(f"  Created organization {org.code}")
        return org

    def _seed_departments(self, org):
        from apps.organization.models import Department

        specs = [
            ("DEPT-EDIT", "Editorial", "production"),
            ("DEPT-PIPELINE", "Pipeline TD", "technical"),
            ("DEPT-COMP", "Compositing", "creative"),
            ("DEPT-FX", "FX", "creative"),
            ("DEPT-LIGHT", "Lighting", "creative"),
        ]
        departments = []
        for code, name, dept_type in specs:
            dept, _ = Department.objects.get_or_create(
                code=code,
                organization=org,
                defaults={
                    "name": name,
                    "description": f"{name} department (seeded)",
                    "department_type": dept_type,
                },
            )
            departments.append(dept)
        return departments

    def _seed_teams(self, org, departments):
        from apps.organization.models import Team

        # One team per department
        teams = []
        for dept in departments:
            code = f"TEAM-{dept.code.split('-')[1]}"
            team, _ = Team.objects.get_or_create(
                code=code,
                organization=org,
                defaults={
                    "name": f"{dept.name} Team",
                    "description": f"Seeded team for {dept.name}",
                    "department": dept,
                },
            )
            teams.append(team)
        return teams

    def _seed_offices(self, org):
        from apps.organization.models import Office

        specs = [
            ("OFF-MUM", "Mumbai Studio", "Mumbai", "headquarters"),
            ("OFF-BLR", "Bengaluru Lab", "Bengaluru", "branch"),
        ]
        offices = []
        for code, name, city, office_type in specs:
            office, _ = Office.objects.get_or_create(
                code=code,
                organization=org,
                defaults={
                    "name": name,
                    "city": city,
                    "country": "IN",
                    "timezone": "Asia/Kolkata",
                    "office_type": office_type,
                },
            )
            offices.append(office)
        return offices

    def _seed_roles_spec(self):
        # (code, name) — must match frontend Role strings where appropriate
        return [
            ("platform-admin", "Platform Admin"),
            ("org-admin", "Organization Admin"),
            ("vfx-supervisor", "VFX Supervisor"),
            ("lead-artist", "Lead Artist"),
            ("artist", "Artist"),
            ("client-reviewer", "Client Reviewer"),
        ]

    def _seed_permissions(self):
        from apps.organization.choices import PermissionModule
        from apps.organization.models import Permission

        valid_modules = {c[0] for c in PermissionModule.choices}
        # Use get_or_create to avoid duplicate permission creation; org permissions may already be seeded via migrations.
        # Frontend codes like "projects:create" use module names outside backend choices; map to a valid module.
        perm_specs = [
            ("projects:create", "projects", "create"),
            ("projects:read", "projects", "read"),
            ("projects:update", "projects", "update"),
            ("projects:delete", "projects", "delete"),
            ("shots:create", "shots", "create"),
            ("shots:read", "shots", "read"),
            ("shots:update", "shots", "update"),
            ("shots:delete", "shots", "delete"),
            ("shots:approve", "shots", "approve"),
            ("assets:create", "assets", "create"),
            ("assets:read", "assets", "read"),
            ("assets:update", "assets", "update"),
            ("assets:delete", "assets", "delete"),
            ("tasks:create", "tasks", "create"),
            ("tasks:read", "tasks", "read"),
            ("tasks:update", "tasks", "update"),
            ("tasks:delete", "tasks", "delete"),
            ("reviews:create", "reviews", "create"),
            ("reviews:read", "reviews", "read"),
            ("reviews:approve", "reviews", "approve"),
            ("audit:read", "audit", "read"),
            ("settings:update", "settings", "update"),
            ("users:manage", "users", "manage"),
        ]
        perms = []
        for code, module, action in perm_specs:
            # Keep original module for uniqueness even if not in PermissionModule choices
            # (choices are enforced only at validation, not DB). This avoids
            # duplicate (module, action) violations when many frontend codes map
            # to the same fallback module.
            safe_module = module  # keep as-is for uniqueness
            safe_action = action if action in {c[0] for c in __import__("apps.organization.choices", fromlist=["PermissionAction"]).PermissionAction.choices} else "view"
            perm, _ = Permission.objects.get_or_create(
                code=code,
                defaults={
                    "name": code,
                    "module": safe_module,
                    "action": safe_action,
                    "category": "general",
                    "is_system": True,
                    "is_active": True,
                },
            )
            perms.append(perm)
        return perms

    def _seed_roles(self, org, perms):
        from apps.organization.models import Role, RolePermission

        perm_by_code = {p.code: p for p in perms}
        # Define which permissions each role gets (mirrors frontend mockUsers)
        role_perms = {
            "platform-admin": list(perm_by_code.keys()),
            "vfx-supervisor": [
                "projects:create", "projects:read", "projects:update",
                "shots:create", "shots:read", "shots:update", "shots:approve",
                "assets:create", "assets:read", "assets:update",
                "tasks:create", "tasks:read", "tasks:update",
                "reviews:create", "reviews:read", "reviews:approve",
                "audit:read",
            ],
            "lead-artist": [
                "projects:read", "shots:read", "shots:update",
                "assets:read", "assets:update",
                "tasks:create", "tasks:read", "tasks:update",
                "reviews:create", "reviews:read", "audit:read",
            ],
            "artist": [
                "projects:read", "shots:read", "tasks:read", "tasks:update",
                "assets:read", "reviews:read",
            ],
            "org-admin": [
                "projects:create", "projects:read", "projects:update", "projects:delete",
                "shots:create", "shots:read", "shots:update", "shots:delete", "shots:approve",
                "assets:create", "assets:read", "assets:update", "assets:delete",
                "tasks:create", "tasks:read", "tasks:update", "tasks:delete",
                "reviews:create", "reviews:read", "reviews:approve",
                "audit:read", "settings:update", "users:manage",
            ],
            "client-reviewer": ["projects:read", "shots:read", "reviews:read", "reviews:approve"],
        }
        roles = {}
        for code, name in self._seed_roles_spec():
            role, _ = Role.objects.get_or_create(
                code=code,
                organization=org,
                defaults={
                    "name": name,
                    "description": f"Seeded role: {name}",
                    "is_system": True,
                    "is_active": True,
                },
            )
            # Assign permissions idempotently
            wanted = role_perms.get(code, [])
            for perm_code in wanted:
                perm = perm_by_code.get(perm_code)
                if perm:
                    RolePermission.objects.get_or_create(
                        role=role,
                        permission=perm,
                        defaults={"granted": True},
                    )
            roles[code] = role
        return roles

    def _seed_users_spec(self):
        # (email, role_code, department_code_hint, is_staff, is_superuser)
        return [
            ("supervisor@studiohub.vfx", "vfx-supervisor", "DEPT-EDIT", True, True),
            ("admin@studiohub.vfx", "platform-admin", "DEPT-PIPELINE", True, True),
            ("lead@studiohub.vfx", "lead-artist", "DEPT-COMP", False, False),
            ("artist@studiohub.vfx", "artist", "DEPT-COMP", False, False),
        ]

    def _seed_users(self, org, departments, teams, offices, roles):
        from apps.identity.models import Profile
        from apps.organization.models import OrganizationMembership

        dept_by_code = {d.code: d for d in departments}
        team_by_code = {t.code: t for t in teams}
        # offices not tied per user in this minimal seed; use first
        default_office = offices[0] if offices else None

        created_users = []
        for email, role_code, dept_code, is_staff, is_superuser in self._seed_users_spec():
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "is_active": True,
                    "is_staff": is_staff,
                    "is_superuser": is_superuser,
                },
            )
            if created:
                user.set_password("password123")
                user.save(update_fields=["password"])
                self.stdout.write(f"  Created user {email}")
            else:
                # Ensure password is set to known value for dev (idempotent)
                if not user.check_password("password123") and not user.check_password("admin"):
                    user.set_password("password123")
                    user.save(update_fields=["password"])
                # Ensure flags
                if user.is_staff != is_staff or user.is_superuser != is_superuser:
                    user.is_staff = is_staff
                    user.is_superuser = is_superuser
                    user.save(update_fields=["is_staff", "is_superuser"])

            # Profile
            first, last = email.split("@")[0].split(".") if "." in email.split("@")[0] else (email.split("@")[0], "")
            # Map to nicer names for known seed users
            name_map = {
                "supervisor@studiohub.vfx": ("Alex", "Chen"),
                "admin@studiohub.vfx": ("Marcus", "Vance"),
                "lead@studiohub.vfx": ("Elena", "Rostova"),
                "artist@studiohub.vfx": ("Sarah", "Jenkins"),
            }
            first, last = name_map.get(email, (first.capitalize(), last.capitalize() if last else ""))

            Profile.objects.get_or_create(
                user=user,
                defaults={
                    "first_name": first,
                    "last_name": last,
                    "display_name": f"{first} {last}".strip(),
                    "timezone": "Asia/Kolkata",
                    "language": "en",
                },
            )

            # Membership
            dept = dept_by_code.get(dept_code) or (departments[0] if departments else None)
            team = team_by_code.get(f"TEAM-{dept_code.split('-')[1]}") if dept else (teams[0] if teams else None)
            role = roles.get(role_code)
            if role:
                OrganizationMembership.objects.get_or_create(
                    user=user,
                    organization=org,
                    defaults={
                        "department": dept,
                        "team": team,
                        "office": default_office,
                        "role": role,
                        "is_primary": True,
                        "status": "active",
                    },
                )
            created_users.append(user)
        return created_users

    # ------------------------------------------------------------------
    # Production seeding (Phase D + I)
    # ------------------------------------------------------------------

    def _seed_projects(self, org, users):
        from apps.production.models import Project

        supervisor = users[0] if users else None
        coordinator = users[1] if len(users) > 1 else supervisor
        specs = [
            ("NK99", "Cyberpunk 2099: Neo-Kyoto", "Feature Film"),
            ("AETH2", "Chronicles of Aethelgard: Season 2", "Episodic Series"),
            ("VEL01", "Apex Velocity: Hyperdrive Trailer", "Game Cinematic"),
        ]
        projects = []
        for code, name, ptype in specs:
            proj, _ = Project.objects.get_or_create(
                code=code,
                organization=org,
                defaults={
                    "name": name,
                    "type": ptype,
                    "description": f"Seeded project {name}",
                    "status": "In Progress",
                    "fps": 24,
                    "resolution": "4096x2160",
                    "aspect_ratio": "2.39:1",
                    "color_space": "ACEScg",
                    "thumbnail_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800",
                    "budget_usd": 1000000,
                    "supervisor": supervisor,
                    "coordinator": coordinator,
                },
            )
            projects.append(proj)
        return projects

    def _seed_shots(self, org, projects, users):
        from apps.production.models import Shot

        shots = []
        for proj in projects[:2]:
            for i, (code, name) in enumerate(
                [("NK_010_010", "Hero Spinner Dive"), ("NK_010_020", "Cockpit Close-Up")], 1
            ):
                # Use project_code + seq + code for uniqueness
                full_code = f"{proj.code}_{code.split('_')[-1]}"
                shot, _ = Shot.objects.get_or_create(
                    code=code,
                    project=proj,
                    defaults={
                        "organization": org,
                        "sequence_code": code.split("_")[0] + "_" + code.split("_")[1],
                        "name": name,
                        "description": f"Seeded shot {name}",
                        "status": "In Progress" if i == 1 else "Approved",
                        "frame_in": 1001,
                        "frame_out": 1100 + i * 10,
                        "handle_frames": 8,
                        "thumbnail_url": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600",
                        "assigned_artist": users[2] if len(users) > 2 else None,
                        "pipeline": {"layout": "Approved", "animation": "Approved", "fx": "In Progress", "lighting": "Not Started", "comp": "Not Started"},
                    },
                )
                shots.append(shot)
        return shots

    def _seed_assets(self, org, projects, users, departments, teams):
        from apps.production.models import Asset

        assets = []
        proj = projects[0] if projects else None
        if not proj:
            return assets
        dept = departments[0] if departments else None
        team = teams[0] if teams else None
        artist = users[3] if len(users) > 3 else None
        specs = [
            ("AST_VEH_SPINNER_04", "Cyber Spinner", "Vehicle"),
            ("AST_CHR_MECHA_09", "Mecha Unit", "Character"),
        ]
        for code, name, cat in specs:
            asset, _ = Asset.objects.get_or_create(
                code=code,
                project=proj,
                defaults={
                    "organization": org,
                    "name": name,
                    "category": cat,
                    "description": f"Seeded asset {name}",
                    "status": "Approved",
                    "version": "v001",
                    "file_format": "OpenUSD",
                    "poly_count": 100000,
                    "lod_levels": 2,
                    "software": "Maya",
                    "department": dept,
                    "team": team,
                    "assigned_artist": artist,
                    "tags": ["Seeded"],
                },
            )
            assets.append(asset)
        return assets

    def _seed_tasks(self, org, projects, shots, assets, users, departments, teams):
        from apps.production.models import Task

        tasks = []
        proj = projects[0] if projects else None
        shot = shots[0] if shots else None
        dept_name = departments[0].name if departments else "FX"
        team_obj = teams[0] if teams else None
        assignee = users[2] if len(users) > 2 else None
        reviewer = users[0] if users else None
        for i, (title, code) in enumerate([("FX Sim", "TSK001"), ("Comp", "TSK002")], 1):
            task, _ = Task.objects.get_or_create(
                code=code,
                project=proj,
                defaults={
                    "organization": org,
                    "title": title,
                    "entity_type": "Shot" if shot else "General",
                    "entity_id": str(shot.id) if shot else "",
                    "entity_code": shot.code if shot else "",
                    "entity_name": shot.name if shot else "",
                    "department": dept_name,
                    "team": team_obj,
                    "assignee": assignee,
                    "reviewer": reviewer,
                    "status": "In Progress",
                    "priority": "Medium",
                    "workflow": {"stage_name": "Test"},
                    "schedule": {"start_date": "2026-08-10", "due_date": "2026-08-26", "estimated_hours": 40, "logged_hours": 10, "progress_percent": 25},
                    "dependencies": {"upstream_task_ids": [], "downstream_task_ids": []},
                    "description": f"Seeded task {title}",
                    "software": "Houdini",
                    "is_archived": False,
                },
            )
            tasks.append(task)
        return tasks

    def _seed_timelogs(self, org, tasks, users):
        from apps.production.models import Timelog
        from datetime import date

        timelogs = []
        for task in tasks[:1]:
            tl, _ = Timelog.objects.get_or_create(
                task=task,
                person=users[2] if len(users) > 2 else users[0],
                date=date(2026, 8, 26),
                defaults={
                    "organization": org,
                    "project": task.project,
                    "duration_hours": 4,
                    "billable": True,
                    "notes": "Seeded timelog",
                    "status": "Submitted",
                    "activity_category": "Direct Work",
                    "hourly_rate_usd": 50,
                    "department": task.department,
                },
            )
            timelogs.append(tl)
        return timelogs

    def _seed_versions(self, org, projects, shots, assets, tasks, users):
        from apps.production.models import Version

        versions = []
        proj = projects[0] if projects else None
        shot = shots[0] if shots else None
        task = tasks[0] if tasks else None
        artist = users[2] if len(users) > 2 else None
        for i, vnum in enumerate(["v001", "v002"], 1):
            code = f"VER-{proj.code if proj else 'PROJ'}-SHOT-{vnum}"
            ver, _ = Version.objects.get_or_create(
                code=code,
                project=proj,
                defaults={
                    "organization": org,
                    "version_number": vnum,
                    "version_index": i,
                    "entity_type": "Shot",
                    "entity_id": str(shot.id) if shot else "",
                    "entity_code": shot.code if shot else "",
                    "shot": shot,
                    "task": task,
                    "department": "Comp",
                    "artist": artist,
                    "status": "Pending Review",
                    "is_published": False,
                    "thumbnail_url": "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800",
                    "resolution": "4096x2160",
                    "fps": 24,
                    "file_size_mb": 100,
                    "color_space": "ACEScg",
                },
            )
            versions.append(ver)
        return versions

    def _seed_reviews(self, org, projects, shots, versions, users):
        from apps.production.models import Review

        reviews = []
        proj = projects[0] if projects else None
        shot = shots[0] if shots else None
        ver = versions[0] if versions else None
        for i in range(1):
            code = f"REV-{proj.code if proj else 'PROJ'}-001"
            rev, _ = Review.objects.get_or_create(
                code=code,
                organization=org,
                defaults={
                    "title": "Seed Review",
                    "description": "Seeded review",
                    "project": proj,
                    "entity_type": "Shot",
                    "entity_id": str(shot.id) if shot else "",
                    "entity_code": shot.code if shot else "",
                    "status": "Pending Review",
                    "lead_reviewer": users[0] if users else None,
                    "lead_reviewer_name": f"{users[0].email}" if users else "",
                    "thumbnail_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600",
                    "versions": [str(ver.id) if ver else ""],
                },
            )
            reviews.append(rev)
        return reviews

    def _seed_playlists(self, org, projects, versions, reviews):
        from apps.production.models import Playlist

        playlists = []
        proj = projects[0] if projects else None
        for i in range(1):
            code = f"PLY-{proj.code if proj else 'PROJ'}-001"
            pl, _ = Playlist.objects.get_or_create(
                code=code,
                organization=org,
                defaults={
                    "name": "Seed Playlist",
                    "description": "Seeded playlist",
                    "project": proj,
                    "status": "Active",
                    "entries": [{"version_id": str(versions[0].id) if versions else ""}],
                },
            )
            playlists.append(pl)
        return playlists

    def _seed_media(self, org, projects, shots, assets):
        from apps.production.models import Media

        media = []
        proj = projects[0] if projects else None
        shot = shots[0] if shots else None
        for i in range(1):
            m, _ = Media.objects.get_or_create(
                organization=org,
                project=proj,
                entity_type="Shot",
                entity_id=str(shot.id) if shot else "",
                media_type="image",
                defaults={
                    "category": "plate",
                    "file_format": "jpg",
                    "source_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800",
                    "preview_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400",
                    "file_size_mb": 5,
                },
            )
            media.append(m)
        return media

    def _seed_workflows(self, org, projects):
        from apps.production.models import Workflow

        workflows = []
        proj = projects[0] if projects else None
        for code, name in [("WF-FILM-01", "Feature Film Pipeline"), ("WF-EPI-01", "Episodic Pipeline")]:
            wf, _ = Workflow.objects.get_or_create(
                code=code,
                organization=org,
                defaults={
                    "name": name,
                    "description": f"Seeded workflow {name}",
                    "category": "production",
                    "is_active": True,
                    "project": proj,
                    "nodes": [{"id": "start", "type": "start"}, {"id": "task", "type": "task"}, {"id": "end", "type": "end"}],
                    "transitions": [{"from": "start", "to": "task"}, {"from": "task", "to": "end"}],
                },
            )
            workflows.append(wf)
        return workflows
