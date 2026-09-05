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
            people = self._seed_people(org)
            activities = self._seed_activities(org, users)
            deliveries = self._seed_deliveries(org, projects, users)
            publishes = self._seed_publishes(org, projects, users)
            destinations = self._seed_destinations(org)
            pipeline_settings = self._seed_pipeline_settings()

        self.stdout.write(self.style.SUCCESS("Seed complete."))
        self.stdout.write(f"  Organization: {org.code} ({org.name})")
        self.stdout.write(f"  Departments: {len(departments)}  Teams: {len(teams)}  Offices: {len(offices)}")
        self.stdout.write(f"  Roles: {len(roles)}  Permissions: {len(perms)}  Users: {len(users)}")
        self.stdout.write(f"  Projects: {len(projects)}  Shots: {len(shots)}  Assets: {len(assets)}")
        self.stdout.write(f"  Tasks: {len(tasks)}  Timelogs: {len(timelogs)}  Versions: {len(versions)}")
        self.stdout.write(f"  Reviews: {len(reviews)}  Playlists: {len(playlists)}  Media: {len(media)}  Workflows: {len(workflows)}")
        self.stdout.write(f"  Clients: {len(clients)}  Vendors: {len(vendors)}  People: {len(people)}")
        self.stdout.write(f"  Activities: {activities}")
        self.stdout.write(f"  Deliveries: {deliveries}  Publishes: {publishes}  Destinations: {destinations}  Pipeline Settings: {pipeline_settings}")
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
        from apps.organization.models import Permission

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
            ("deliveries:create", "deliveries", "create"),
            ("deliveries:read", "deliveries", "read"),
            ("deliveries:update", "deliveries", "update"),
            ("deliveries:delete", "deliveries", "delete"),
            ("publishing:create", "publishing", "create"),
            ("publishing:read", "publishing", "read"),
            ("publishing:update", "publishing", "update"),
            ("publishing:delete", "publishing", "delete"),
            ("scheduling:create", "scheduling", "create"),
            ("scheduling:read", "scheduling", "read"),
            ("scheduling:update", "scheduling", "update"),
            ("scheduling:delete", "scheduling", "delete"),
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
                "deliveries:create", "deliveries:read", "deliveries:update",
                "publishing:create", "publishing:read", "publishing:update",
                "scheduling:create", "scheduling:read", "scheduling:update",
                "audit:read",
            ],
            "lead-artist": [
                "projects:read", "shots:read", "shots:update",
                "assets:read", "assets:update",
                "tasks:create", "tasks:read", "tasks:update",
                "reviews:create", "reviews:read",
                "deliveries:read", "publishing:read", "scheduling:read",
                "audit:read",
            ],
            "artist": [
                "projects:read", "shots:read", "tasks:read", "tasks:update",
                "assets:read", "reviews:read",
                "deliveries:read", "publishing:read", "scheduling:read",
            ],
            "org-admin": [
                "projects:create", "projects:read", "projects:update", "projects:delete",
                "shots:create", "shots:read", "shots:update", "shots:delete", "shots:approve",
                "assets:create", "assets:read", "assets:update", "assets:delete",
                "tasks:create", "tasks:read", "tasks:update", "tasks:delete",
                "reviews:create", "reviews:read", "reviews:approve",
                "deliveries:create", "deliveries:read", "deliveries:update", "deliveries:delete",
                "publishing:create", "publishing:read", "publishing:update", "publishing:delete",
                "scheduling:create", "scheduling:read", "scheduling:update", "scheduling:delete",
                "audit:read", "settings:update", "users:manage",
            ],
            "client-reviewer": ["projects:read", "shots:read", "reviews:read", "reviews:approve", "deliveries:read", "publishing:read"],
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
        from unittest.mock import MagicMock

        from apps.production.management.commands.seed_production_mocks import (
            Command as ProdMockCommand,
        )
        from apps.production.models import Project

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_projects(frontend_root / "production" / "projects.ts", org)
        return list(Project.objects.filter(organization=org))

    def _seed_shots(self, org, projects, users):
        from pathlib import Path
        from unittest.mock import MagicMock

        from apps.production.management.commands.seed_production_mocks import (
            Command as ProdMockCommand,
        )
        from apps.production.models import Shot

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_shots(frontend_root / "production" / "shots.ts", org)
        return list(Shot.objects.filter(organization=org))

    def _seed_assets(self, org, projects, users, departments, teams):
        from pathlib import Path
        from unittest.mock import MagicMock

        from apps.production.management.commands.seed_production_mocks import (
            Command as ProdMockCommand,
        )
        from apps.production.models import Asset

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_assets(frontend_root / "assets" / "assets.ts", org)
        return list(Asset.objects.filter(organization=org))

    def _seed_tasks(self, org, projects, shots, assets, users, departments, teams):
        from pathlib import Path
        from unittest.mock import MagicMock

        from apps.production.management.commands.seed_production_mocks import (
            Command as ProdMockCommand,
        )
        from apps.production.models import Task

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_tasks(frontend_root / "tasks" / "tasks.ts", org)
        return list(Task.objects.filter(organization=org))

    def _seed_timelogs(self, org, tasks, users):
        from pathlib import Path
        from unittest.mock import MagicMock

        from apps.production.management.commands.seed_production_mocks import (
            Command as ProdMockCommand,
        )
        from apps.production.models import Timelog

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_timelogs(frontend_root / "production" / "timelogs.ts", org)
        return list(Timelog.objects.filter(organization=org))

    def _seed_versions(self, org, projects, shots, assets, tasks, users):
        from pathlib import Path
        from unittest.mock import MagicMock

        from apps.production.management.commands.seed_production_mocks import (
            Command as ProdMockCommand,
        )
        from apps.production.models import Version

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_versions(frontend_root / "versions" / "versions.ts", org)
        return list(Version.objects.filter(organization=org))

    def _seed_reviews(self, org, projects, shots, versions, users):
        from pathlib import Path
        from unittest.mock import MagicMock

        from apps.production.management.commands.seed_production_mocks import (
            Command as ProdMockCommand,
        )
        from apps.production.models import Review

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_reviews(frontend_root / "reviews" / "reviews.ts", org)
        return list(Review.objects.filter(organization=org))

    def _seed_playlists(self, org, projects, versions, reviews):
        from pathlib import Path
        from unittest.mock import MagicMock

        from apps.production.management.commands.seed_production_mocks import (
            Command as ProdMockCommand,
        )
        from apps.production.models import Playlist

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_playlists(frontend_root / "production" / "playlists.ts", org)
        return list(Playlist.objects.filter(organization=org))

    def _seed_media(self, org, projects, shots, assets):
        from pathlib import Path
        from unittest.mock import MagicMock

        from apps.production.management.commands.seed_production_mocks import (
            Command as ProdMockCommand,
        )
        from apps.production.models import Media

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_media(frontend_root / "production" / "media.ts", org)
        return list(Media.objects.filter(organization=org))

    def _seed_workflows(self, org, projects):
        from pathlib import Path
        from unittest.mock import MagicMock

        from apps.production.management.commands.seed_production_mocks import (
            Command as ProdMockCommand,
        )
        from apps.production.models import Workflow

        cmd = ProdMockCommand()
        cmd.stdout = MagicMock()
        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        cmd._seed_workflows(frontend_root / "production" / "workflow.ts", org)
        return list(Workflow.objects.filter(organization=org))

    def _seed_clients(self, org):
        # Seed from frontend mockClients
        from pathlib import Path

        from apps.organization.models import Client
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
        from pathlib import Path

        from apps.organization.models import Vendor
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

    def _seed_people(self, org):
        from pathlib import Path

        from apps.organization.models import Person
        from apps.production.management.commands.seed_production_mocks import _load_ts_mock_array

        frontend_root = Path(__file__).resolve().parents[5] / "frontend" / "src" / "mocks" / "db"
        data = _load_ts_mock_array(frontend_root / "organization" / "organization.ts", "mockPeople")
        count = 0
        for item in data:
            full_name = item.get("full_name")
            if not full_name:
                continue
            Person.objects.update_or_create(
                name=full_name,
                defaults={
                    "email": item.get("email", ""),
                    "phone": item.get("phone", ""),
                },
            )
            count += 1
        return list(Person.objects.all())

    def _seed_activities(self, org, users):
        """
        Seed Activity records consumed by the frontend activity store.

        The Activity model stores arbitrary activity context in its JSON
        ``metadata`` field; the frontend maps it back into its
        ``ActivityLogItem`` shape (action / actionLabel / entity / diffs).
        Idempotent: keyed on (description, user). Backdated for realistic feeds.
        """
        from datetime import timedelta

        from django.utils import timezone

        from apps.audit.models.activity import Activity

        user_by_email = {u.email: u for u in users}
        actor_by_email = {
            "supervisor@studiohub.vfx": ("Alex Chen", "VFX Supervisor"),
            "admin@studiohub.vfx": ("Marcus Vance", "Platform Admin"),
            "lead@studiohub.vfx": ("Elena Rostova", "Lead Artist"),
            "artist@studiohub.vfx": ("Sarah Jenkins", "Artist"),
        }

        # (activity_type, email, description, action, actionLabel, entity, ip, hours_ago, diffs)
        specs = [
            (
                "interaction",
                "supervisor@studiohub.vfx",
                "Approved final compositing on shot LUM01_0010 (v14).",
                "approve",
                "APPROVE",
                {"type": "shot", "id": "LUM01_0010", "code": "LUM01_0010", "name": "Aurora Crystal Formation", "context": "Luminary Aurora"},
                12,
                None,
            ),
            (
                "interaction",
                "supervisor@studiohub.vfx",
                "Created review session for Luminary Aurora trailer turnover.",
                "review",
                "REVIEW",
                {"type": "review", "id": "rev-lum-01", "code": "REV-LUM-01", "name": "Luminary Trailer Turnover", "context": "Luminary Aurora"},
                26,
                None,
            ),
            (
                "interaction",
                "admin@studiohub.vfx",
                "Assigned FX shot VEL01_0022 to Elena Rostova (Lead Artist).",
                "assign",
                "ASSIGN",
                {"type": "task", "id": "tsk-vel-022", "code": "VEL01_0022", "name": "Nebula Lensing Pass", "context": "Apex Velocity"},
                40,
                None,
            ),
            (
                "feature_usage",
                "artist@studiohub.vfx",
                "Logged 4.5 hours on asset build AST-LUM-HERO-01.",
                "upload",
                "UPLOAD",
                {"type": "asset", "id": "AST-LUM-HERO-01", "code": "AST-LUM-HERO-01", "name": "Crystalline Hero Rig", "context": "Luminary Aurora"},
                52,
                None,
            ),
            (
                "interaction",
                "lead@studiohub.vfx",
                "Updated shot LUM01_0024 status from In Progress to Ready for Review.",
                "status_change",
                "UPDATE",
                {"type": "shot", "id": "LUM01_0024", "code": "LUM01_0024", "name": "Holographic Billboard Reveal", "context": "Luminary Aurora"},
                66,
                None,
            ),
            (
                "export",
                "admin@studiohub.vfx",
                "Exported production report for Apex Velocity as CSV.",
                "export",
                "EXPORT",
                {"type": "project", "id": "VEL01", "code": "VEL01", "name": "Apex Velocity: Hyperdrive Trailer", "context": "Apex Digital Studios"},
                80,
                None,
            ),
            (
                "interaction",
                "supervisor@studiohub.vfx",
                "Created new project 'Apex Velocity: Hyperdrive Trailer'.",
                "create",
                "CREATE",
                {"type": "project", "id": "VEL01", "code": "VEL01", "name": "Apex Velocity: Hyperdrive Trailer", "context": "Apex Digital Studios"},
                94,
                None,
            ),
            (
                "interaction",
                "artist@studiohub.vfx",
                "Uploaded version v12 of shot LUM01_0010 for review.",
                "upload",
                "UPLOAD",
                {"type": "version", "id": "LUM01_0010_v12", "code": "v12", "name": "LUM01_0010 v12", "context": "Luminary Aurora"},
                110,
                None,
            ),
            (
                "interaction",
                "admin@studiohub.vfx",
                "Granted 'Lead Artist' role to Elena Rostova.",
                "permission_change",
                "PERMISSION_CHANGE",
                {"type": "person", "id": "usr-lead", "code": "usr-lead", "name": "Elena Rostova", "context": "Apex Digital Studios"},
                124,
                None,
            ),
            (
                "dashboard",
                "supervisor@studiohub.vfx",
                "Viewed Luminary Aurora production dashboard.",
                "status_change",
                "VIEW",
                {"type": "project", "id": "LUM01", "code": "LUM01", "name": "Luminary Aurora: Cosmic Awakening", "context": "Apex Digital Studios"},
                138,
                None,
            ),
            (
                "interaction",
                "lead@studiohub.vfx",
                "Commented on review REV-LUM-01 for shot LUM01_0010.",
                "comment",
                "COMMENT",
                {"type": "review", "id": "rev-lum-01", "code": "REV-LUM-01", "name": "Luminary Trailer Turnover", "context": "Luminary Aurora"},
                152,
                None,
            ),
            (
                "interaction",
                "artist@studiohub.vfx",
                "Deleted stale placeholder asset AST-OLD-TMP-00.",
                "delete",
                "DELETE",
                {"type": "asset", "id": "AST-OLD-TMP-00", "code": "AST-OLD-TMP-00", "name": "Legacy Temp Asset", "context": "Apex Velocity"},
                166,
                None,
            ),
            (
                "feature_usage",
                "supervisor@studiohub.vfx",
                "Ran global asset search across all active productions.",
                "search",
                "SEARCH",
                {"type": "asset", "id": "global-search", "code": "asset-search", "name": "Global Asset Search", "context": "Apex Digital Studios"},
                180,
                None,
            ),
            (
                "interaction",
                "admin@studiohub.vfx",
                "Assigned team FX Team to project Luminary Aurora.",
                "assign",
                "ASSIGN",
                {"type": "team", "id": "TEAM-FX", "code": "TEAM-FX", "name": "FX Team", "context": "Luminary Aurora"},
                194,
                None,
            ),
            (
                "report",
                "supervisor@studiohub.vfx",
                "Generated weekly delivery status report for all shows.",
                "export",
                "EXPORT",
                {"type": "organization", "id": "APEX", "code": "APEX", "name": "Apex Digital Studios", "context": "Studio Hub"},
                208,
                None,
            ),
            (
                "interaction",
                "lead@studiohub.vfx",
                "Updated task VEL01_0022 estimated hours from 12 to 16.",
                "update",
                "UPDATE",
                {"type": "task", "id": "tsk-vel-022", "code": "VEL01_0022", "name": "Nebula Lensing Pass", "context": "Apex Velocity"},
                222,
                [{"field": "estimated_hours", "label": "Estimated Hours", "before": 12, "after": 16}],
            ),
        ]

        now = timezone.now()
        user_agent = (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        )
        count = 0
        for (
            activity_type,
            email,
            description,
            action,
            action_label,
            entity,
            hours_ago,
            diffs,
        ) in specs:
            user = user_by_email.get(email) or (users[0] if users else None)
            if user is None:
                continue
            actor_name, actor_role = actor_by_email.get(email, (email.split("@")[0], "Member"))

            activity, created = Activity.objects.get_or_create(
                description=description,
                user=user,
                organization=org,
                defaults={
                    "activity_type": activity_type,
                    "status": Activity.STATUS_SUCCESS,
                    "ip_address": "10.0.0.15",
                    "user_agent": user_agent,
                    "duration_seconds": 2,
                    "metadata": {
                        "action": action,
                        "actionLabel": action_label,
                        "entity": entity,
                        "actor": {"name": actor_name, "role": actor_role},
                        "diffs": diffs or [],
                    },
                },
            )
            if created:
                Activity.objects.filter(pk=activity.pk).update(
                    created_at=now - timedelta(hours=hours_ago)
                )
                count += 1
        return count

    def _seed_deliveries(self, org, projects, users):
        """
        Seed demo client turnover delivery packages (idempotent).

        Uses the real delivery service so records are valid and consistent.
        """
        from datetime import timedelta

        from django.utils import timezone

        from apps.deliveries.models import DeliveryPackage
        from apps.deliveries.services.delivery import (
            approve_delivery,
            prepare_delivery,
            reject_delivery,
            submit_delivery,
        )
        from apps.organization.models import Client

        clients = list(Client.objects.filter(organization=org))
        actor_id = str(users[0].id) if users else None
        created = 0
        now = timezone.now()

        specs = [
            {
                "name": "Scheduled Picture Lock Turnover",
                "code": "DEL-LUM01-2026-W01",
                "project": projects[0] if projects else None,
                "client": clients[0] if clients else None,
                "method": "Aspera",
                "destination": "s3://studiohub-deliveries/luminary-aurora/s01/picture-lock/",
                "expires": now + timedelta(days=7),
                "notes": "Final picture lock turnover for Luminary Aurora Episode 101.",
            },
            {
                "name": "VFX Review Batch 03",
                "code": "DEL-AETH2-2026-W02",
                "project": projects[2] if len(projects) > 2 else None,
                "client": clients[1] if len(clients) > 1 else None,
                "method": "Aspera",
                "destination": "signiant://netflix-originals/vfx-review-batch-03/",
                "expires": now + timedelta(days=14),
                "notes": "Intermediate VFX review delivery.",
            },
            {
                "name": "Trailer Color & Finishing Package",
                "code": "DEL-VEL01-2026-W03",
                "project": projects[1] if len(projects) > 1 else None,
                "client": clients[2] if len(clients) > 2 else None,
                "method": "S3",
                "destination": "s3://studiohub-deliveries/apex-velocity/finishing/",
                "expires": now + timedelta(days=3),
                "notes": "Color finishing and delivery spec package.",
            },
        ]

        for spec in specs:
            delivery, was_created = DeliveryPackage.objects.get_or_create(
                organization=org,
                code=spec["code"],
                defaults={
                    "name": spec["name"],
                    "project": spec["project"],
                    "client": spec["client"],
                    "delivery_method": spec["method"],
                    "delivery_destination": spec["destination"],
                    "expires_at": spec["expires"],
                    "notes": spec["notes"],
                },
            )
            if was_created:
                created += 1

            # Drive statuses through the real service for realistic state transitions.
            if spec["code"] == "DEL-LUM01-2026-W01":
                prepare_delivery(
                    delivery_id=str(delivery.id),
                    user_id=actor_id,
                    organization_id=str(org.id),
                )
                submit_delivery(
                    delivery_id=str(delivery.id),
                    user_id=actor_id,
                    organization_id=str(org.id),
                )
            elif spec["code"] == "DEL-AETH2-2026-W02":
                prepare_delivery(
                    delivery_id=str(delivery.id),
                    user_id=actor_id,
                    organization_id=str(org.id),
                )
                submit_delivery(
                    delivery_id=str(delivery.id),
                    user_id=actor_id,
                    organization_id=str(org.id),
                )
                approve_delivery(
                    delivery_id=str(delivery.id),
                    user_id=actor_id,
                    organization_id=str(org.id),
                )
            elif spec["code"] == "DEL-VEL01-2026-W03":
                prepare_delivery(
                    delivery_id=str(delivery.id),
                    user_id=actor_id,
                    organization_id=str(org.id),
                )
                submit_delivery(
                    delivery_id=str(delivery.id),
                    user_id=actor_id,
                    organization_id=str(org.id),
                )
                reject_delivery(
                    delivery_id=str(delivery.id),
                    user_id=actor_id,
                    organization_id=str(org.id),
                    rejection_reason="Color space mismatch on delivery spec sheet.",
                )

        return created

    def _seed_publishes(self, org, projects, users):
        """
        Seed demo publish items (idempotent).
        """
        from apps.publishing.models import PublishItem

        actor = users[0] if users else None
        created = 0

        specs = [
            {
                "code": "PUB-LUM01-SH010-V001",
                "name": "Shot 010 - Color VFX",
                "project": projects[0] if projects else None,
                "entity_type": "Shot",
                "entity_id": "shot-101",
                "entity_code": "LUM01_SH010",
                "entity_name": "Shot 010",
                "dcc_tool": "Nuke",
                "dcc_version": "15.0v2",
                "source_file": "/mnt/storage/vfx_prod/shots/LUM01/SH010/comp/v001/source.nk",
                "source_version": "v001",
                "export_path": "/mnt/storage/vfx_prod/publishes/LUM01/SH010/v001/",
                "export_format": "EXR",
                "status": "Exported",
            },
            {
                "code": "PUB-AETH2-ASSET-BOT-USD",
                "name": "Bot Character - USD",
                "project": projects[2] if len(projects) > 2 else None,
                "entity_type": "Asset",
                "entity_id": "asset-bot",
                "entity_code": "AETH2_BOT",
                "entity_name": "Bot Character",
                "dcc_tool": "Houdini",
                "dcc_version": "20.0",
                "source_file": "/mnt/storage/vfx_prod/assets/AETH2/BOT/model/v003/bot_geo.hiplc",
                "source_version": "v003",
                "export_path": "/mnt/storage/vfx_prod/publishes/AETH2/BOT/v003/usd/",
                "export_format": "USD",
                "status": "Validated",
            },
            {
                "code": "PUB-VEL01-SH004-LIGHT",
                "name": "Shot 004 - Lighting",
                "project": projects[1] if len(projects) > 1 else None,
                "entity_type": "Shot",
                "entity_id": "shot-004",
                "entity_code": "VEL01_SH004",
                "entity_name": "Shot 004",
                "dcc_tool": "Maya Light",
                "dcc_version": "2025.1",
                "source_file": "/mnt/storage/vfx_prod/shots/VEL01/SH004/light/v002/scene.ma",
                "source_version": "v002",
                "export_path": "/mnt/storage/vfx_prod/publishes/VEL01/SH004/v002/",
                "export_format": "USD",
                "status": "Exported",
            },
        ]

        for spec in specs:
            _, was_created = PublishItem.objects.get_or_create(
                organization=org,
                code=spec["code"],
                defaults={
                    "name": spec["name"],
                    "project": spec["project"],
                    "entity_type": spec["entity_type"],
                    "entity_id": spec["entity_id"],
                    "entity_code": spec["entity_code"],
                    "entity_name": spec["entity_name"],
                    "dcc_tool": spec["dcc_tool"],
                    "dcc_version": spec["dcc_version"],
                    "source_file": spec["source_file"],
                    "source_version": spec["source_version"],
                    "export_path": spec["export_path"],
                    "export_format": spec["export_format"],
                    "status": spec["status"],
                    "created_by": actor,
                },
            )
            if was_created:
                created += 1

        return created

    def _seed_destinations(self, org):
        """
        Seed publish + delivery destinations (idempotent).

        Static reference data presented as dropdown options in creation
        flows. Idempotent via get_or_create keyed on (organization, name).
        """
        from apps.deliveries.models import DeliveryDestination
        from apps.publishing.models import PublishDestination

        created = 0

        publish_specs = [
            {
                "name": "Primary Storage Cluster",
                "destination_type": PublishDestination.TYPE_STORAGE_CLUSTER,
                "path": "/mnt/storage/vfx_prod/publishes",
                "protocol": PublishDestination.PROTOCOL_NFS,
                "is_default": True,
                "region": "Local On-Prem",
            },
            {
                "name": "Cloud Global Cache",
                "destination_type": PublishDestination.TYPE_CLOUD_S3,
                "path": "s3://studiohub-vfx-global-publishes",
                "protocol": PublishDestination.PROTOCOL_S3,
                "is_default": False,
                "region": "ap-northeast-1",
            },
            {
                "name": "Daily Review Repository",
                "destination_type": PublishDestination.TYPE_REVIEW_REPO,
                "path": "/mnt/editorial/dailies_h264",
                "protocol": PublishDestination.PROTOCOL_SMB,
                "is_default": False,
                "region": "Editorial Wing",
            },
        ]

        for spec in publish_specs:
            _, was_created = PublishDestination.objects.get_or_create(
                organization=org,
                name=spec["name"],
                defaults=spec,
            )
            if was_created:
                created += 1

        delivery_specs = [
            {
                "name": "Aspera Point-to-Point",
                "destination_type": DeliveryDestination.TYPE_ASPERA,
                "endpoint": "aspera.example.com:33001",
                "credentials_configured": False,
                "transfer_rate_mbps": 850,
                "storage_region": "US-West",
                "port": 33001,
                "target_directory": "/incoming/vfx/turnovers",
            },
            {
                "name": "S3 Master Delivery Bucket",
                "destination_type": DeliveryDestination.TYPE_S3,
                "endpoint": "s3://studiohub-vfx-masters/deliveries",
                "credentials_configured": False,
                "transfer_rate_mbps": 1200,
                "storage_region": "us-east-1",
                "target_directory": "/deliveries",
            },
        ]

        for spec in delivery_specs:
            _, was_created = DeliveryDestination.objects.get_or_create(
                organization=org,
                name=spec["name"],
                defaults=spec,
            )
            if was_created:
                created += 1

        return created

    def _seed_pipeline_settings(self):
        """
        Seed pipeline/environment settings consumed by the frontend SettingsPage.

        The frontend pipeline settings form reads/writes these as a flat key->value
        map via ``/api/v1/settings/system-settings/``. Each field is modelled as a
        SettingDefinition (data_type + choices + default) plus a SystemSetting value.
        Idempotent via get_or_create keyed on the definition code.
        """
        import json

        from apps.settings.models.category import SettingCategory
        from apps.settings.models.definition import SettingDefinition
        from apps.settings.models.system import SystemSetting

        category, _ = SettingCategory.objects.get_or_create(
            code="pipeline",
            defaults={
                "name": "Studio Pipeline",
                "description": "Render pipeline, color science and USD architecture settings.",
                "icon": "layers",
                "is_active": True,
            },
        )

        # code -> (name, data_type, default_value, choices)
        specs = [
            (
                "pipeline.default_color_space",
                "Default Working Color Space",
                SettingDefinition.TYPE_SELECT,
                "ACEScg - ACES 1.3",
                [
                    "ACEScg - ACES 1.3",
                    "ACES 2.0 Candidate",
                    "Rec.709 - ITU-R BT.709",
                    "ARRI LogC4 / Wide Gamut 4",
                    "REDWideGamutRGB / Log3G10",
                ],
            ),
            (
                "pipeline.default_fps",
                "Default Timebase / FPS",
                SettingDefinition.TYPE_FLOAT,
                "24",
                [24, 23.976, 25, 29.97, 60],
            ),
            (
                "pipeline.ocio_config_path",
                "OCIO Config File Path",
                SettingDefinition.TYPE_STRING,
                "/opt/studiohub/ocio/aces_1.3/config.ocio",
                [],
            ),
            (
                "pipeline.usd_schema_version",
                "USD Schema Specification",
                SettingDefinition.TYPE_SELECT,
                "OpenUSD v24.08",
                ["OpenUSD v24.08", "OpenUSD v23.11", "OpenUSD v22.11"],
            ),
            (
                "pipeline.default_resolution",
                "Default Resolution Buffer",
                SettingDefinition.TYPE_SELECT,
                "4096x2160",
                ["4096x2160", "3840x2160", "2048x1080", "1920x1080"],
            ),
            (
                "pipeline.storage_mount_path",
                "Central SAN / NAS Storage Root Path",
                SettingDefinition.TYPE_STRING,
                "/mnt/studiohub/shows",
                [],
            ),
            (
                "pipeline.farm_engine",
                "Render Farm Management Engine",
                SettingDefinition.TYPE_SELECT,
                "Deadline",
                ["Deadline", "Tractor", "OpenCue"],
            ),
            (
                "pipeline.enable_ai_denoising",
                "Enable AI Denoising",
                SettingDefinition.TYPE_BOOLEAN,
                "true",
                [],
            ),
            (
                "pipeline.enable_auto_transcode",
                "Enable Auto Transcode",
                SettingDefinition.TYPE_BOOLEAN,
                "true",
                [],
            ),
            (
                "pipeline.enable_webhooks",
                "Enable Webhooks",
                SettingDefinition.TYPE_BOOLEAN,
                "false",
                [],
            ),
        ]

        count = 0
        for code, name, data_type, default, choices in specs:
            definition, _ = SettingDefinition.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "description": name,
                    "category": category,
                    "data_type": data_type,
                    "scope": SettingDefinition.SCOPE_SYSTEM,
                    "default_value": json.dumps(default),
                    "is_active": True,
                    "choices": choices,
                    "order": count,
                },
            )
            _, created = SystemSetting.objects.get_or_create(
                setting=definition,
                defaults={"value": json.dumps(default)},
            )
            if created:
                count += 1
        return count
