"""
Frontend-compatible User serializer helper.

Produces payload matching ``frontend/src/types/auth.ts`` User interface,
aggregating User + Profile + OrganizationMembership + Role permissions.
"""

from __future__ import annotations

from typing import Any


def serialize_frontend_user(user, request=None) -> dict[str, Any]:
    """
    Serialize backend User into frontend User shape.

    Frontend expects:
      id, email, first_name, last_name, full_name, avatar_url, role,
      permissions[], organization_id, organization_name, department,
      is_active, is_staff, is_superuser, created_at, updated_at
    """
    # Profile: may not exist for some users; fallback gracefully
    profile = getattr(user, "profile", None)
    # Try to fetch via related query if not prefetched and None but exists in DB
    if profile is None:
        try:
            from apps.identity.models import Profile

            profile = Profile.objects.filter(user=user).first()
        except Exception:
            profile = None

    first_name = getattr(profile, "first_name", "") if profile else ""
    last_name = getattr(profile, "last_name", "") if profile else ""
    full_name = getattr(profile, "full_name", "") if profile else ""
    if not full_name:
        # Fallback to display_name or email prefix
        full_name = getattr(profile, "display_name", "") if profile else ""
    if not full_name:
        full_name = (f"{first_name} {last_name}").strip() or user.email

    avatar_url = None
    if profile is not None:
        # Prefer the remote avatar URL (seeded from mock); fall back to any
        # uploaded avatar file.
        if getattr(profile, "avatar_url", ""):
            avatar_url = profile.avatar_url
        elif getattr(profile, "avatar", None):
            try:
                avatar_url = profile.avatar.url if profile.avatar else None
            except Exception:
                avatar_url = None

    # Organization context: prefer header-driven org, then primary membership
    organization_id = ""
    organization_name = ""
    department_name = ""
    role_name = "Artist"
    permissions: list[str] = []

    # Try to resolve active organization from request header (compat with both header names)
    org = None
    membership = None
    if request is not None:
        # Respect middleware-populated attributes if available
        org = getattr(request, "organization", None)
        membership = getattr(request, "membership", None)
        # If middleware used X-Organization but frontend sends X-Organization-Id, header fallback
        if org is None:
            header_org_id = request.headers.get("X-Organization-Id") or request.headers.get("X-Organization")
            if header_org_id:
                try:
                    from apps.organization.models import Organization, OrganizationMembership

                    org = Organization.objects.filter(id=header_org_id, is_deleted=False).first()
                    if org and getattr(request, "user", None) and request.user.is_authenticated:
                        membership = OrganizationMembership.objects.filter(
                            user=user, organization=org, is_deleted=False
                        ).select_related("role", "department", "organization").first()
                except Exception:
                    pass

    # Fallback to primary membership or first active membership
    if membership is None:
        try:
            from apps.organization.models import OrganizationMembership

            qs = OrganizationMembership.objects.filter(user=user, is_deleted=False).select_related(
                "organization", "role", "department"
            )
            # Prefer primary
            membership = qs.filter(is_primary=True).first() or qs.first()
            if membership:
                org = membership.organization
        except Exception:
            membership = None

    if membership and org is None:
        org = getattr(membership, "organization", None)

    if org:
        organization_id = str(org.id)
        organization_name = getattr(org, "name", "")

    if membership:
        if getattr(membership, "department", None):
            department_name = getattr(membership.department, "name", "") or ""
        if getattr(membership, "role", None):
            role_name = getattr(membership.role, "name", role_name) or role_name
            # Resolve permissions via RolePermission
            try:
                from apps.organization.models import Permission

                # Use code field which matches frontend strings like "project.create"
                perms_qs = Permission.objects.filter(
                    role_permissions__role=membership.role,
                    role_permissions__granted=True,
                    is_deleted=False,
                    is_active=True,
                ).values_list("code", flat=True)
                permissions = sorted(set(perms_qs))
            except Exception:
                permissions = []

    # Superuser break-glass fallback: no membership but is_superuser gets broad permissions (ADR-0033 D4).
    if not permissions and (user.is_superuser):
        # Minimal broad set for admin users without explicit role
        permissions = [
            "project.create", "project.view", "project.update", "project.delete",
            "shot.create", "shot.view", "shot.update", "shot.delete", "shot.approve",
            "asset.create", "asset.view", "asset.update", "asset.delete",
            "task.create", "task.view", "task.update", "task.delete",
            "review.create", "review.view", "review.approve",
            "audit.view", "settings.update", "user.manage",
        ]

    # Ensure role string matches one of frontend expected roles; fallback already Artist
    # Frontend role strings are display names, not codes.

    # ADR-0033 D1/D2: project/show memberships travel with the user payload so
    # the frontend route guards and canonical engine can evaluate production
    # scope without guessing org linkage from fixtures.
    from apps.production.models.project_membership import ProjectMembership

    project_memberships: list[dict[str, Any]] = []
    try:
        pms = (
            ProjectMembership.objects.filter(user=user, is_deleted=False)
            .select_related("project", "organization", "show")
        )
        project_memberships = [
            {
                "id": str(pm.id),
                "user_id": str(pm.user_id),
                "organization_id": str(pm.organization_id),
                "project_id": str(pm.project_id),
                "project_code": getattr(pm.project, "code", "") or "",
                "show_id": str(pm.show_id) if pm.show_id else None,
                "role": pm.role,
                "roles": pm.roles or ([pm.role] if pm.role else []),
                "scope": pm.scope,
                "status": pm.status,
                "department": pm.department,
                "department_id": pm.department_id,
                "team_id": pm.team_id,
                "vendor_id": pm.vendor_id,
                "client_id": pm.client_id,
            }
            for pm in pms
        ]
    except Exception:
        project_memberships = []

    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
        "avatar_url": avatar_url,
        "role": role_name,
        "permissions": permissions,
        "organization_id": organization_id,
        "organization_name": organization_name,
        "department": department_name,
        "project_memberships": project_memberships,
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "is_superuser": getattr(user, "is_superuser", False),
        "created_at": user.created_at.isoformat() if getattr(user, "created_at", None) else "",
        "updated_at": user.updated_at.isoformat() if getattr(user, "updated_at", None) else "",
    }


_MEMBERSHIP_STATUS_MAP = {
    "active": "Active",
    "on_leave": "On Leave",
    "terminated": "Terminated",
    "suspended": "Suspended",
}


def serialize_frontend_membership(membership) -> dict[str, Any]:
    """
    Serialize an OrganizationMembership into the frontend
    OrganizationMembership shape (see frontend types/auth.ts):

      id, user_id, organization_id, organization_name, organization_code?,
      organization_slug?, role, permissions[], is_default?, status,
      department?, joined_at?
    """
    org = getattr(membership, "organization", None)
    role = getattr(membership, "role", None)
    department = getattr(membership, "department", None)
    permissions: list[str] = []
    role_name = "Artist"
    if role is not None:
        role_name = getattr(role, "name", role_name) or role_name
        try:
            from apps.organization.models import Permission

            perms_qs = Permission.objects.filter(
                role_permissions__role=role,
                role_permissions__granted=True,
                is_deleted=False,
                is_active=True,
            ).values_list("code", flat=True)
            permissions = sorted(set(perms_qs))
        except Exception:
            permissions = []
    raw_status = getattr(membership, "status", "active") or "active"
    return {
        "id": str(membership.id),
        "user_id": str(membership.user_id),
        "organization_id": str(getattr(org, "id", "")) if org else "",
        "organization_name": getattr(org, "name", "") if org else "",
        "organization_code": getattr(org, "code", "") if org else "",
        "organization_slug": getattr(org, "slug", "") if org else "",
        "role": role_name,
        "permissions": permissions,
        "is_default": bool(getattr(membership, "is_primary", False)),
        "status": _MEMBERSHIP_STATUS_MAP.get(raw_status, raw_status),
        "department": getattr(department, "name", "") if department else "",
        "joined_at": membership.joined_at.isoformat()
        if getattr(membership, "joined_at", None)
        else "",
    }
