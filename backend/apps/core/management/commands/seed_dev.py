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
            clients = self._seed_clients(org)
            vendors = self._seed_vendors(org)

        self.stdout.write(self.style.SUCCESS("Seed complete."))
        self.stdout.write(f"  Organization: {org.code} ({org.name})")
        self.stdout.write(f"  Departments: {len(departments)}  Teams: {len(teams)}  Offices: {len(offices)}")
        self.stdout.write(f"  Roles: {len(roles)}  Permissions: {len(perms)}  Users: {len(users)}")
        self.stdout.write(f"  Projects: {len(projects)}  Shots: {len(shots)}  Assets: {len(assets)}")
        self.stdout.write(f"  Tasks: {len(tasks)}  Timelogs: {len(timelogs)}  Versions: {len(versions)}")
        self.stdout.write(f"  Reviews: {len(reviews)}  Playlists: {len(playlists)}  Media: {len(media)}  Workflows: {len(workflows)}")
        self.stdout.write(f"  Clients: {len(clients)}  Vendors: {len(vendors)}")
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
    # Production seeding (full mock) — delegates to seed_production_mocks logic
    # ------------------------------------------------------------------

    def _seed_projects(self, org, users):
        from pathlib import Path

        from apps.production.management.commands.seed_production_mocks import Command as ProdMockCommand
        from apps.production.models import Project
        from unittest.mock import MagicMock

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_projects(frontend_root / "production" / "projects.ts", org)
        return list(Project.objects.filter(organization=org))

    def _seed_shots(self, org, projects, users):
        from pathlib import Path

        from apps.production.management.commands.seed_production_mocks import Command as ProdMockCommand
        from apps.production.models import Shot
        from unittest.mock import MagicMock

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_shots(frontend_root / "production" / "shots.ts", org)
        return list(Shot.objects.filter(organization=org))

    def _seed_assets(self, org, projects, users, departments, teams):
        from pathlib import Path

        from apps.production.management.commands.seed_production_mocks import Command as ProdMockCommand
        from apps.production.models import Asset
        from unittest.mock import MagicMock

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_assets(frontend_root / "assets" / "assets.ts", org)
        return list(Asset.objects.filter(organization=org))

    def _seed_tasks(self, org, projects, shots, assets, users, departments, teams):
        from pathlib import Path

        from apps.production.management.commands.seed_production_mocks import Command as ProdMockCommand
        from apps.production.models import Task
        from unittest.mock import MagicMock

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_tasks(frontend_root / "tasks" / "tasks.ts", org)
        return list(Task.objects.filter(organization=org))

    def _seed_timelogs(self, org, tasks, users):
        from pathlib import Path

        from apps.production.management.commands.seed_production_mocks import Command as ProdMockCommand
        from apps.production.models import Timelog
        from unittest.mock import MagicMock

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_timelogs(frontend_root / "production" / "timelogs.ts", org)
        return list(Timelog.objects.filter(organization=org))

    def _seed_versions(self, org, projects, shots, assets, tasks, users):
        from pathlib import Path

        from apps.production.management.commands.seed_production_mocks import Command as ProdMockCommand
        from apps.production.models import Version
        from unittest.mock import MagicMock

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_versions(frontend_root / "versions" / "versions.ts", org)
        return list(Version.objects.filter(organization=org))

    def _seed_reviews(self, org, projects, shots, versions, users):
        from pathlib import Path

        from apps.production.management.commands.seed_production_mocks import Command as ProdMockCommand
        from apps.production.models import Review
        from unittest.mock import MagicMock

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_reviews(frontend_root / "reviews" / "reviews.ts", org)
        return list(Review.objects.filter(organization=org))

    def _seed_playlists(self, org, projects, versions, reviews):
        from pathlib import Path

        from apps.production.management.commands.seed_production_mocks import Command as ProdMockCommand
        from apps.production.models import Playlist
        from unittest.mock import MagicMock

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_playlists(frontend_root / "production" / "playlists.ts", org)
        return list(Playlist.objects.filter(organization=org))

    def _seed_media(self, org, projects, shots, assets):
        from pathlib import Path

        from apps.production.management.commands.seed_production_mocks import Command as ProdMockCommand
        from apps.production.models import Media
        from unittest.mock import MagicMock

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_media(frontend_root / "production" / "media.ts", org)
        return list(Media.objects.filter(organization=org))

    def _seed_workflows(self, org, projects):
        from pathlib import Path

        from apps.production.management.commands.seed_production_mocks import Command as ProdMockCommand
        from apps.production.models import Workflow
        from unittest.mock import MagicMock

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_workflows(frontend_root / "production" / "workflow.ts", org)
        return list(Workflow.objects.filter(organization=org))

    def _seed_clients(self, org):
        from apps.organization.models import Client

        # Seed from frontend mockClients
        from pathlib import Path

        from apps.production.management.commands.seed_production_mocks import _load_ts_mock_array

        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        data = _load_ts_mock_array(frontend_root / "organization" / "organization.ts", "mockClients")
        count = 0
        for item in data:
            code = item.get("code")
            if not code:
                continue
            Client.objects.update_or_create(
                code=code,
                organization=org,
                defaults={
                    "name": item.get("name", code),
                    "contact_name": item.get("contact_name", ""),
                    "email": item.get("email", ""),
                    "phone": item.get("phone", ""),
                    "studio_type": item.get("studio_type", "Major Studio"),
                    "active_projects": item.get("active_projects", []),
                    "contract_tier": item.get("contract_tier", "Standard Producer"),
                    "portal_access": item.get("portal_access", True),
                    "status": item.get("status", "Active"),
                    "logo_url": item.get("logo_url", ""),
                    "headquarters": item.get("headquarters", ""),
                    "total_billed_usd": item.get("total_billed_usd", 0) or 0,
                },
            )
            count += 1
        # Fallback if no data (e.g., parsing failed)
        if count == 0:
            for code, name in [("WNS", "Warner Nexus Studios"), ("AMC", "Amazon Prime Original Productions")]:
                Client.objects.get_or_create(
                    code=code,
                    organization=org,
                    defaults={
                        "name": name,
                        "contact_name": "Seed Contact",
                        "email": f"contact@{code.lower()}.com",
                        "status": "Active",
                    },
                )
                count += 1
        return list(Client.objects.filter(organization=org))

    def _seed_vendors(self, org):
        from apps.organization.models import Vendor

        from pathlib import Path

        from apps.production.management.commands.seed_production_mocks import _load_ts_mock_array

        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        data = _load_ts_mock_array(frontend_root / "organization" / "organization.ts", "mockVendors")
        count = 0
        for item in data:
            code = item.get("code")
            if not code:
                continue
            Vendor.objects.update_or_create(
                code=code,
                organization=org,
                defaults={
                    "name": item.get("name", code),
                    "contact_name": item.get("contact_name", ""),
                    "email": item.get("email", ""),
                    "specialization": item.get("specialization", "Roto & Paint"),
                    "security_tier": item.get("security_tier", "Standard Studio NDA"),
                    "nda_signed": item.get("nda_signed", False),
                    "active_projects": item.get("active_projects", []),
                    "rating": item.get("rating", 4.5) or 4.5,
                    "location": item.get("location", ""),
                    "status": item.get("status", "Approved Partner"),
                    "logo_url": item.get("logo_url", ""),
                    "bandwidth_gbps": item.get("bandwidth_gbps", 10) or 10,
                },
            )
            count += 1
        if count == 0:
            for code, name in [("VEN-01", "Silhouette FX Labs"), ("VEN-02", "Nordic Creatures")]:
                Vendor.objects.get_or_create(
                    code=code,
                    organization=org,
                    defaults={"name": name, "contact_name": "Seed Vendor", "status": "Approved Partner"},
                )
                count += 1
        return list(Vendor.objects.filter(organization=org))
