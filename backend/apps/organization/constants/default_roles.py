"""
Canonical default role catalog for organizations (ADR-0033 D1, Phase 9).

Single source of truth for the organization RBAC starter set — consumed by:

- ``apps/core/management/commands/seed_dev.py`` (dev/demo seeding)
- ``apps/masterdata/services/initialization.py`` (organization provisioning
  on create — a new org is immediately usable)

Codes are canonical dot notation. ``permissions=None`` means "everything in
the catalog" (platform-admin full grant).
"""

from __future__ import annotations

from apps.organization.choices import RolePriority, RoleScope

# Org-directory reads granted org-wide (company directory is readable);
# org-entity mutations stay with org-admin.
ORG_VIEW_PERMISSIONS = [
    "organization.view",
    "organization.department.view",
    "organization.team.view",
    "organization.office.view",
    "organization_settings.view",
    "person.view",
    "position.view",
    "identity.user.view",
]

ORG_CRUD_PERMISSIONS = [
    "organization.view", "organization.create", "organization.update", "organization.delete",
    "organization.department.view", "organization.department.create",
    "organization.department.update", "organization.department.delete",
    "organization.team.view", "organization.team.create",
    "organization.team.update", "organization.team.delete",
    "organization.office.view", "organization.office.create",
    "organization.office.update", "organization.office.delete",
    "organization_settings.view", "organization_settings.create",
    "organization_settings.update", "organization_settings.delete",
    "person.view", "person.create", "person.update", "person.delete",
    "position.view", "position.create", "position.update", "position.delete",
    "identity.user.view",
]

PRODUCTION_FULL = [
    "project.create", "project.view", "project.update", "project.delete",
    "shot.create", "shot.view", "shot.update", "shot.delete", "shot.approve",
    "asset.create", "asset.view", "asset.update", "asset.delete",
    "task.create", "task.view", "task.update", "task.delete",
    "review.create", "review.view", "review.approve",
    "delivery.create", "delivery.view", "delivery.update", "delivery.delete",
    "publishing.create", "publishing.view", "publishing.update", "publishing.delete",
    "schedule.create", "schedule.view", "schedule.update", "schedule.delete",
    "track.create", "track.view", "track.update", "track.delete",
    "show.create", "show.view", "show.update", "show.delete",
    "audit.view",
]

PRODUCTION_LEAD = [
    "project.view", "shot.view", "shot.update", "shot.approve",
    "asset.create", "asset.view", "asset.update",
    "task.create", "task.view", "task.update",
    "review.create", "review.view",
    "delivery.view", "publishing.view", "schedule.view",
    "track.view", "show.view", "audit.view",
]

PRODUCTION_ARTIST = [
    "project.view", "shot.view", "task.view", "task.update",
    "asset.view", "review.view",
    "delivery.view", "publishing.view", "schedule.view",
    "track.view", "show.view",
]

CLIENT_REVIEWER = [
    "project.view", "shot.view", "review.view", "review.approve",
    "delivery.view", "publishing.view", "organization.view",
]

# (code, name, priority, scope, permission codes; None = full catalog)
DEFAULT_ROLE_SPECS = [
    {
        "code": "platform-admin",
        "name": "Platform Admin",
        "priority": RolePriority.ADMIN,
        "scope": RoleScope.ORGANIZATION,
        "permissions": None,  # full catalog
    },
    {
        "code": "org-admin",
        "name": "Organization Admin",
        "priority": RolePriority.ADMIN,
        "scope": RoleScope.ORGANIZATION,
        "permissions": ORG_CRUD_PERMISSIONS + PRODUCTION_FULL + ["settings.manage", "settings.update", "user.manage"],
    },
    {
        "code": "org-member",
        "name": "Organization Member",
        "priority": RolePriority.MEMBER,
        "scope": RoleScope.ORGANIZATION,
        "permissions": ORG_VIEW_PERMISSIONS,
    },
    {
        "code": "production-admin",
        "name": "Production Admin",
        "priority": RolePriority.MANAGER,
        "scope": RoleScope.PROJECT,
        "permissions": PRODUCTION_FULL,
    },
    {
        "code": "vfx-supervisor",
        "name": "VFX Supervisor",
        "priority": RolePriority.LEAD,
        "scope": RoleScope.PROJECT,
        "permissions": PRODUCTION_FULL,
    },
    {
        "code": "lead-artist",
        "name": "Lead Artist",
        "priority": RolePriority.LEAD,
        "scope": RoleScope.PROJECT,
        "permissions": PRODUCTION_LEAD,
    },
    {
        "code": "artist",
        "name": "Artist",
        "priority": RolePriority.MEMBER,
        "scope": RoleScope.PROJECT,
        "permissions": PRODUCTION_ARTIST,
    },
    {
        "code": "client-reviewer",
        "name": "Client Reviewer",
        "priority": RolePriority.VIEWER,
        "scope": RoleScope.PROJECT,
        "permissions": CLIENT_REVIEWER + ["organization.view"],
    },
]
