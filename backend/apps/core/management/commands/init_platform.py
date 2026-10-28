"""
Platform initialization command (org-removal B6).

Idempotent bootstrap of the platform-global reference data every fresh
database needs:

  - identity ``Permission`` catalog and ``Role`` catalog (with the
    role -> permission matrix, org-free)
  - masterdata ``MasterStatus`` workflow statuses
  - masterdata ``Department`` / ``Team`` / ``Office`` / ``Position``
    directory rows

Everything is keyed on ``code`` via ``get_or_create`` so the command is
safe to run repeatedly (and after any partial run).

Usage:
  python manage.py init_platform
"""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

# ---------------------------------------------------------------------------
# Canonical catalogs (org-free). Shared by the seed commands so dev seeding
# and platform bootstrap stay in lock-step.
# ---------------------------------------------------------------------------

# (code, module, action) — module/action mirror the frontend codes; the
# identity Permission model stores them verbatim (choices are validated on
# save, not enforced at the DB layer) so catalog codes stay stable.
PERMISSION_SPECS: list[tuple[str, str, str]] = [
    ("project.create", "projects", "create"),
    ("project.view", "projects", "read"),
    ("project.update", "projects", "update"),
    ("project.delete", "projects", "delete"),
    ("shot.create", "shots", "create"),
    ("shot.view", "shots", "read"),
    ("shot.update", "shots", "update"),
    ("shot.delete", "shots", "delete"),
    ("shot.approve", "shots", "approve"),
    ("sequence.view", "sequences", "read"),
    ("version.view", "versions", "read"),
    ("media.view", "media", "read"),
    ("asset.create", "assets", "create"),
    ("asset.view", "assets", "read"),
    ("asset.update", "assets", "update"),
    ("asset.delete", "assets", "delete"),
    ("task.create", "tasks", "create"),
    ("task.view", "tasks", "read"),
    ("task.update", "tasks", "update"),
    ("task.delete", "tasks", "delete"),
    ("review.create", "reviews", "create"),
    ("review.view", "reviews", "read"),
    ("review.approve", "reviews", "approve"),
    ("delivery.create", "deliveries", "create"),
    ("delivery.view", "deliveries", "read"),
    ("delivery.update", "deliveries", "update"),
    ("delivery.delete", "deliveries", "delete"),
    # Workflow codes (docs/deliveries/CONTRACTS.md section 4, roles in docs/deliveries/PLAN.md
    # section 6). The two override codes are in OPT_IN_PERMISSIONS below: granted to no role.
    ("delivery.approve", "deliveries", "approve"),
    ("delivery.send", "deliveries", "send"),
    ("delivery.view_secret", "deliveries_secret", "view_secret"),
    ("publishing.create", "publishing", "create"),
    ("publishing.view", "publishing", "read"),
    ("publishing.update", "publishing", "update"),
    ("publishing.delete", "publishing", "delete"),
    # Storage roots are studio-wide: platform-admin (full catalog) and org-admin hold it.
    ("publishing.storage.manage", "publishing_storage", "manage"),
    ("track.create", "tracks", "create"),
    ("track.view", "tracks", "read"),
    ("track.update", "tracks", "update"),
    ("track.delete", "tracks", "delete"),
    ("show.create", "shows", "create"),
    ("show.view", "shows", "read"),
    ("show.update", "shows", "update"),
    ("show.delete", "shows", "delete"),
    ("schedule.create", "scheduling", "create"),
    ("schedule.view", "scheduling", "read"),
    ("schedule.update", "scheduling", "update"),
    ("schedule.delete", "scheduling", "delete"),
    ("automation.create", "automation", "create"),
    ("automation.view", "automation", "read"),
    ("automation.update", "automation", "update"),
    ("automation.delete", "automation", "delete"),
    ("note.create", "notes", "create"),
    ("timelog.manage", "timelogs", "manage"),
    ("audit.view", "audit", "read"),
    ("audit.update", "audit", "update"),
    ("settings.update", "settings", "update"),
    ("settings.manage", "settings", "manage"),
    ("user.manage", "users", "manage"),
    # Platform master data (docs/masterdata/DECISIONS.md D9). The former
    # platform.master_data.configure / create codes are retired (see
    # RETIRED_PERMISSION_CODES).
    ("masterdata.catalog.manage", "masterdata_catalog", "manage"),
    ("masterdata.hard_delete", "masterdata", "hard_delete"),
    ("masterdata.directory.manage", "masterdata_directory", "manage"),
    ("masterdata.person.view_sensitive", "masterdata_person", "view_sensitive"),
    ("masterdata.client.view_financial", "masterdata_client", "view_financial"),
    # Identity domain (enforced by the identity RBAC viewsets).
    ("identity.user.view", "user", "view"),
    ("identity.user.create", "user", "create"),
    ("identity.user.update", "user", "update"),
    ("identity.user.delete", "user", "delete"),
    ("identity.user.manage", "user", "manage"),
    ("identity.role.view", "role", "view"),
    ("identity.role.create", "role", "create"),
    ("identity.role.update", "role", "update"),
    ("identity.role.delete", "role", "delete"),
    ("identity.group.view", "group", "view"),
    ("identity.group.create", "group", "create"),
    ("identity.group.update", "group", "update"),
    ("identity.group.delete", "group", "delete"),
    ("identity.permission.view", "permission", "view"),
    ("identity.permission.create", "permission", "create"),
    ("identity.permission.update", "permission", "update"),
    ("identity.permission.delete", "permission", "delete"),
]

# Directory reads granted to production-tier roles (org-free directory is
# readable by everyone who can see the platform).
DIRECTORY_VIEW_PERMISSIONS = [
    "identity.user.view",
]

# Codes that nothing enforces any more. ``init_platform`` deletes them and every role grant of
# them, so a holder of only one of these has no masterdata access at all (D9, Phase 8).
RETIRED_PERMISSION_CODES = (
    "platform.master_data.configure",
    "platform.master_data.create",
)

# What org-admin holds for masterdata: the new codes EXPLICITLY (DECISIONS D9, Option B, transitional: the catalogs are global, so
# catalog.manage belongs to a platform-level role; follow-up FU-1). Deliberately not
# hard_delete. view_sensitive / view_financial keep the access it has today to
# contact data and contract values now that those are gated.
DIRECTORY_CRUD_PERMISSIONS = [
    "masterdata.directory.manage",
    "masterdata.catalog.manage",
    "masterdata.person.view_sensitive",
    "masterdata.client.view_financial",
    "identity.user.view",
]

# ---------------------------------------------------------------------------
# Production role matrix (docs/production/DECISIONS.md D-07). Least privilege: a role
# gets an action only when its work needs it. Every code the production API enforces
# is granted to at least one role (apps/production/tests/test_permission_matrix.py).
# ---------------------------------------------------------------------------

# resource -> (module, actions); action "view" is stored as "read".
_PRODUCTION_RESOURCES: dict[str, tuple[str, tuple[str, ...]]] = {
    "project": ("projects", ("view", "create", "update", "delete")),
    "sequence": ("sequences", ("view", "create", "update", "delete")),
    "episode": ("episodes", ("view", "create", "update", "delete")),
    "shot": ("shots", ("view", "create", "update", "delete", "approve")),
    "asset": ("assets", ("view", "create", "update", "delete")),
    "task": ("tasks", ("view", "create", "update", "delete")),
    # view = own timelogs, view_all = the project's; manage = log time for others
    "timelog": (
        "timelogs",
        ("view", "view_all", "create", "update", "delete", "approve", "manage"),
    ),
    "version": ("versions", ("view", "create", "update", "delete", "publish")),
    "review": ("reviews", ("view", "create", "update", "delete", "approve")),
    "playlist": ("playlists", ("view", "create", "update", "delete")),
    "media": ("media", ("view", "create", "update", "delete")),
    "workflow": ("workflows", ("view", "create", "update", "delete")),
    # view_rates = resources' pay rates and e-mail addresses (full roles only)
    "schedule": ("scheduling", ("view", "view_rates", "create", "update", "delete")),
    # manage_studio = templates that belong to the whole studio rather than one project
    "tasktemplate": ("task_templates", ("view", "create", "update", "delete", "manage_studio")),
    "track": ("tracks", ("view", "create", "update", "delete")),
    "show": ("shows", ("view", "create", "update", "delete")),
    "automation": ("automation", ("view", "create", "update", "delete")),
    # approve = sign off; send = send and record the client's answer; view_secret = the passcode
    "delivery": ("deliveries", ("view", "create", "update", "delete", "approve", "send", "view_secret")),
    # deprecate / revoke = move a registered file between its lifecycle states
    "publishing": ("publishing", ("view", "create", "update", "delete", "deprecate", "revoke")),
}

# Opt-in corrections: in the catalog so an admin can grant them, in no seeded role.
OPT_IN_PERMISSIONS = [
    ("production.status.override", "production_status", "override"),
    ("production.sod.override", "production_sod", "override"),
    # Leaving a guarded published-file state (Revoked), with a reason; docs/publishing/CONTRACTS.md.
    ("publishing.status.override", "publishing_status", "override"),
    # Correcting the status of a sent or cancelled delivery, and signing off one's own work; both
    # need a reason (docs/deliveries/CONTRACTS.md DOM-DLV-02, DOM-DLV-07).
    ("delivery.status.override", "delivery_status", "override"),
    ("delivery.sod.override", "delivery_sod", "override"),
]
OPT_IN_PERMISSION_CODES = frozenset(code for code, _, _ in OPT_IN_PERMISSIONS)


def _production_codes(**actions: str) -> list[str]:
    """``_production_codes(shot="view update")`` -> ``["shot.view", "shot.update"]``."""
    return [f"{resource}.{action}" for resource, spec in actions.items() for action in spec.split()]


def _extend_permission_specs() -> None:
    known = {code for code, _, _ in PERMISSION_SPECS}
    for resource, (module, actions) in _PRODUCTION_RESOURCES.items():
        for action in actions:
            code = f"{resource}.{action}"
            if code not in known:
                PERMISSION_SPECS.append((code, module, "read" if action == "view" else action))
                known.add(code)
    if "production.code.rename" not in known:
        PERMISSION_SPECS.append(("production.code.rename", "production_code", "rename"))
        known.add("production.code.rename")
    for spec in OPT_IN_PERMISSIONS:
        if spec[0] not in known:
            PERMISSION_SPECS.append(spec)
            known.add(spec[0])
    for extra in ("note.create", "audit.view"):
        assert extra in known, extra


_extend_permission_specs()

PRODUCTION_FULL_PERMISSIONS = [
    code for resource, (_, actions) in _PRODUCTION_RESOURCES.items() for code in
    (f"{resource}.{action}" for action in actions)
] + ["note.create", "audit.view"]

# What a vfx-supervisor does not hold of the full production set (docs/delivery-pipeline Q34).
VFX_SUPERVISOR_WITHHELD = frozenset(
    {"publishing.delete", "delivery.delete", "delivery.send", "delivery.view_secret"}
)

# Grants a system role no longer holds, removed by ``init_platform`` on every run so rerunning it
# makes an existing database match the matrix (docs/delivery-pipeline Q34, answered A in Q40).
# Only system roles are touched; the codes are never in that role's own matrix.
WITHDRAWN_GRANTS: dict[str, tuple[str, ...]] = {
    "vfx-supervisor": tuple(sorted(VFX_SUPERVISOR_WITHHELD)),
}

# Production admins track contract and budget figures; supervisors, leads and
# artists share PRODUCTION_FULL_PERMISSIONS or less and do not see them.
PRODUCTION_ADMIN_PERMISSIONS = PRODUCTION_FULL_PERMISSIONS + [
    "masterdata.client.view_financial",
    "production.code.rename",
]

# A lead builds and publishes the team's work and approves its time and shots; no deletes,
# no reviews' final say, no workflow design.
PRODUCTION_LEAD_PERMISSIONS = _production_codes(
    project="view",
    sequence="view",
    episode="view",
    shot="view update approve",
    asset="view create update",
    task="view create update",
    timelog="view view_all create update approve",
    version="view create update publish",
    review="view create update",
    playlist="view create update",
    media="view create update",
    workflow="view",
    schedule="view",
    tasktemplate="view",
    track="view",
    show="view",
    delivery="view",
    publishing="view create",
) + ["audit.view", "note.create"]

# An artist reads what the work needs, logs their own time and publishes their own versions.
PRODUCTION_ARTIST_PERMISSIONS = _production_codes(
    project="view",
    sequence="view",
    episode="view",
    shot="view",
    asset="view",
    task="view update",
    timelog="view create update",
    version="view create",
    review="view",
    playlist="view",
    media="view create",
    workflow="view",
    schedule="view",
    tasktemplate="view",
    track="view",
    show="view",
    delivery="view",
    publishing="view",
) + ["note.create"]

# (code, name, priority, scope, permission codes; None = full catalog)
ROLE_SPECS: list[dict[str, Any]] = [
    {
        "code": "platform-admin",
        "name": "Platform Admin",
        "priority": 10,  # identity RolePriority.ADMIN
        "scope": "organization",  # identity RoleScope.ORGANIZATION
        "permissions": None,  # full catalog
    },
    {
        "code": "org-admin",
        "name": "Organization Admin",
        # Legacy org-era role kept for seed compatibility (seed_studiohub maps
        # "Organization Admin"/"Organization Owner" onto it). Deliberately
        # below ADMIN so it no longer matches the platform-admin visibility
        # check (_has_global_admin_role); it confers no platform-wide scope.
        "priority": 20,  # identity RolePriority.MANAGER
        "scope": "organization",
        "permissions": (
            DIRECTORY_CRUD_PERMISSIONS
            + PRODUCTION_FULL_PERMISSIONS
            + ["settings.manage", "settings.update", "user.manage", "publishing.storage.manage"]
        ),
    },
    {
        "code": "org-member",
        "name": "Organization Member",
        "priority": 40,  # identity RolePriority.MEMBER
        "scope": "organization",
        "permissions": DIRECTORY_VIEW_PERMISSIONS,
    },
    {
        "code": "production-admin",
        "name": "Production Admin",
        "priority": 20,  # identity RolePriority.MANAGER
        "scope": "project",
        "permissions": PRODUCTION_ADMIN_PERMISSIONS,
    },
    {
        "code": "vfx-supervisor",
        "name": "VFX Supervisor",
        "priority": 30,  # identity RolePriority.LEAD
        "scope": "project",
        # Deleting export job records and deliveries is an admin task, and producers send and read
        # the passcode: supervisors sign off (docs/delivery-pipeline Q34).
        "permissions": [
            c for c in PRODUCTION_FULL_PERMISSIONS if c not in VFX_SUPERVISOR_WITHHELD
        ],
    },
    {
        "code": "lead-artist",
        "name": "Lead Artist",
        "priority": 30,
        "scope": "project",
        "permissions": PRODUCTION_LEAD_PERMISSIONS,
    },
    {
        "code": "artist",
        "name": "Artist",
        "priority": 40,
        "scope": "project",
        "permissions": PRODUCTION_ARTIST_PERMISSIONS,
    },
]

# (code, name, entity_type, category, is_default, is_final)
STATUS_SPECS: list[tuple[str, str, str, str, bool, bool]] = [
    ("todo", "Todo", "Task", "", False, False),
    ("in-progress", "In Progress", "Task", "", False, False),
    ("review", "In Review", "Task", "", False, False),
    ("done", "Done", "Task", "", True, False),
    ("approved", "Approved", "Task", "", False, True),
    ("not-started", "Not Started", "Shot", "", False, False),
    ("wip", "WIP", "Shot", "", False, False),
    ("ready-for-review", "Ready for Review", "Shot", "", False, False),
    ("final", "Final", "Shot", "", False, True),
]

# (code, name, department_type, description)
DEPARTMENT_SPECS: list[tuple[str, str, str, str]] = [
    ("DEPT-EDIT", "Editorial", "production", "Editorial department (seeded)"),
    ("DEPT-PIPELINE", "Pipeline TD", "technical", "Pipeline TD department (seeded)"),
    ("DEPT-COMP", "Compositing", "creative", "Compositing department (seeded)"),
    ("DEPT-FX", "FX", "creative", "FX department (seeded)"),
    ("DEPT-LIGHT", "Lighting", "creative", "Lighting department (seeded)"),
]

# (code, name, department_code, description)
TEAM_SPECS: list[tuple[str, str, str, str]] = [
    ("TEAM-EDIT", "Editorial Team", "DEPT-EDIT", "Seeded team for Editorial"),
    ("TEAM-PIPELINE", "Pipeline TD Team", "DEPT-PIPELINE", "Seeded team for Pipeline TD"),
    ("TEAM-COMP", "Compositing Team", "DEPT-COMP", "Seeded team for Compositing"),
    ("TEAM-FX", "FX Team", "DEPT-FX", "Seeded team for FX"),
    ("TEAM-LIGHT", "Lighting Team", "DEPT-LIGHT", "Seeded team for Lighting"),
]

# (code, name, city, country, office_type, is_headquarters)
OFFICE_SPECS: list[tuple[str, str, str, str, str, bool]] = [
    ("OFF-MUM", "Mumbai Studio", "Mumbai", "IN", "headquarters", True),
    ("OFF-BLR", "Bengaluru Lab", "Bengaluru", "IN", "branch", False),
]

# (code, name, department_code, level, is_managerial)
POSITION_SPECS: list[tuple[str, str, str, int, bool]] = [
    ("POS-VFX-SUP", "VFX Supervisor", "DEPT-EDIT", 2, True),
    ("POS-LEAD", "Lead Artist", "DEPT-COMP", 2, True),
    ("POS-ARTIST", "Artist", "DEPT-COMP", 1, False),
    ("POS-PIPELINE", "Pipeline TD", "DEPT-PIPELINE", 2, False),
]


class Command(BaseCommand):
    help = "Initialize platform-global reference data (idempotent)"

    def handle(self, *args, **options):
        self.stdout.write("Initializing platform reference data...")
        with transaction.atomic():
            perms = self._seed_permissions()
            retired = self._retire_permissions()
            roles = self._seed_roles(perms)
            withdrawn = self._withdraw_grants(roles)
            self._seed_statuses()
            self._seed_departments()
            self._seed_teams()
            self._seed_offices()
            self._seed_positions()
        self.stdout.write(
            self.style.SUCCESS(
                f"Platform initialized: {len(perms)} permissions"
                f"{f' ({retired} retired grants/codes removed)' if retired else ''}"
                f"{f' ({withdrawn} withdrawn role grants removed)' if withdrawn else ''}, "
                f"{len(ROLE_SPECS)} roles, {len(STATUS_SPECS)} statuses, "
                f"{len(DEPARTMENT_SPECS)} departments, {len(TEAM_SPECS)} teams, "
                f"{len(OFFICE_SPECS)} offices, {len(POSITION_SPECS)} positions."
            )
        )

    # ------------------------------------------------------------------
    # Permissions / roles (identity)
    # ------------------------------------------------------------------

    def _seed_permissions(self):
        from apps.identity.models import Permission

        perms = []
        for code, module, action in PERMISSION_SPECS:
            perm, _ = Permission.objects.get_or_create(
                code=code,
                defaults={
                    "name": code,
                    "module": module,
                    "action": action,
                    "category": "general",
                    "is_system": True,
                    "is_active": True,
                },
            )
            perms.append(perm)
        return perms

    def _retire_permissions(self) -> int:
        """Remove retired permission codes and every role grant of them (idempotent).

        Real deletes, not soft ones: the RBAC delete signals then drop the holders' cached
        permissions. Returns how many rows were removed.
        """
        from apps.identity.models import Permission, RolePermission

        removed = 0
        grants = RolePermission.all_objects.filter(permission__code__in=RETIRED_PERMISSION_CODES)
        for grant in grants:
            grant.hard_delete()
            removed += 1
        for permission in Permission.all_objects.filter(code__in=RETIRED_PERMISSION_CODES):
            permission.hard_delete()
            removed += 1
        return removed

    def _withdraw_grants(self, roles) -> int:
        """Remove the grants in ``WITHDRAWN_GRANTS`` from the seeded system roles (idempotent).

        Real deletes, not soft ones, like ``_retire_permissions``: the RBAC delete signals then
        drop the holders' cached permissions. Returns how many grants were removed.
        """
        from apps.identity.models import RolePermission

        removed = 0
        for role_code, codes in WITHDRAWN_GRANTS.items():
            role = roles.get(role_code)
            if role is None or not role.is_system:
                continue
            for grant in RolePermission.all_objects.filter(
                role=role, permission__code__in=codes
            ):
                grant.hard_delete()
                removed += 1
        return removed

    def _role_perm_matrix(self, perm_by_code):
        """Map role code -> permission codes from the canonical catalog."""
        matrix = {}
        for spec in ROLE_SPECS:
            perms = spec["permissions"]
            codes = (
                [code for code in perm_by_code if code not in OPT_IN_PERMISSION_CODES]
                if perms is None
                else list(perms)
            )
            # Production-tier (project-scope) roles keep platform directory
            # reads (contract parity with the org-era seed: the directory is
            # visible to everyone who can see the platform).
            if spec["scope"] == "project":
                codes = list(dict.fromkeys(codes + DIRECTORY_VIEW_PERMISSIONS))
            matrix[spec["code"]] = codes
        return matrix

    def _assign_role_permissions(self, role, perm_by_code, role_perms):
        """Grant a role its matrix permissions idempotently."""
        from apps.identity.models import RolePermission

        wanted = role_perms.get(role.code, [])
        for perm_code in wanted:
            perm = perm_by_code.get(perm_code)
            if perm:
                RolePermission.objects.get_or_create(
                    role=role,
                    permission=perm,
                    defaults={"granted": True},
                )

    def _seed_roles(self, perms):
        from apps.identity.models import Role

        perm_by_code = {p.code: p for p in perms}
        role_perms = self._role_perm_matrix(perm_by_code)
        roles = {}
        for spec in ROLE_SPECS:
            role, _ = Role.objects.get_or_create(
                code=spec["code"],
                defaults={
                    "name": spec["name"],
                    "description": f"Platform role: {spec['name']}",
                    "priority": spec["priority"],
                    "scope": spec["scope"],
                    "is_system": True,
                    "is_active": True,
                },
            )
            self._assign_role_permissions(role, perm_by_code, role_perms)
            roles[spec["code"]] = role
        return roles

    # ------------------------------------------------------------------
    # Statuses (masterdata)
    # ------------------------------------------------------------------

    def _seed_statuses(self):
        """Seed the system statuses through the service (idempotent).

        Natural key is ``(entity_type, code)``. Existing rows (live or
        soft-deleted) are never overwritten; a pre-existing match is only
        flagged ``is_system``.
        """
        from apps.masterdata.models import MasterStatus
        from apps.masterdata.services.catalog import MasterStatusService

        count = 0
        for code, name, entity_type, category, is_default, is_final in STATUS_SPECS:
            existing = MasterStatus.all_objects.filter(
                entity_type=entity_type, code__iexact=code
            ).first()
            if existing is not None:
                if not existing.is_system:
                    existing.is_system = True
                    existing.save(update_fields=["is_system"])
                continue
            MasterStatusService.create(
                actor=None,
                system=True,
                data={
                    "code": code,
                    "name": name,
                    "entity_type": entity_type,
                    "category": category,
                    "is_default": is_default,
                    "is_final": is_final,
                },
            )
            count += 1
        return count

    # ------------------------------------------------------------------
    # Directory (masterdata)
    # ------------------------------------------------------------------

    def _seed_departments(self):
        from apps.masterdata.models import Department

        count = 0
        for code, name, dept_type, description in DEPARTMENT_SPECS:
            _, created = Department.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "description": description,
                    "department_type": dept_type,
                },
            )
            if created:
                count += 1
        return count

    def _seed_teams(self):
        from apps.masterdata.models import Department, Team

        dept_by_code = {d.code: d for d in Department.objects.all()}
        count = 0
        for code, name, dept_code, description in TEAM_SPECS:
            _, created = Team.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "description": description,
                    "department": dept_by_code.get(dept_code),
                },
            )
            if created:
                count += 1
        return count

    def _seed_offices(self):
        from apps.masterdata.models import Office

        count = 0
        for code, name, city, country, office_type, is_hq in OFFICE_SPECS:
            _, created = Office.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "city": city,
                    "country": country,
                    "office_type": office_type,
                    "timezone": "Asia/Kolkata",
                    "is_headquarters": is_hq,
                },
            )
            if created:
                count += 1
        return count

    def _seed_positions(self):
        from apps.masterdata.models import Department, Position

        dept_by_code = {d.code: d for d in Department.objects.all()}
        count = 0
        for code, name, dept_code, level, is_managerial in POSITION_SPECS:
            _, created = Position.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "department": dept_by_code.get(dept_code),
                    "level": level,
                    "is_managerial": is_managerial,
                },
            )
            if created:
                count += 1
        return count
