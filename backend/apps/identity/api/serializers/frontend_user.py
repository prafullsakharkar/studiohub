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
    if profile and getattr(profile, "avatar", None):
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

                # Use code field which matches frontend strings like "projects:create"
                perms_qs = Permission.objects.filter(
                    role_permissions__role=membership.role,
                    role_permissions__granted=True,
                    is_deleted=False,
                    is_active=True,
                ).values_list("code", flat=True)
                permissions = sorted(set(perms_qs))
            except Exception:
                permissions = []

    # Staff / superuser fallback: if no membership but is_staff/superuser, give broad permissions
    if not permissions and (user.is_staff or user.is_superuser):
        # Minimal broad set for admin users without explicit role
        permissions = [
            "projects:create", "projects:read", "projects:update", "projects:delete",
            "shots:create", "shots:read", "shots:update", "shots:delete", "shots:approve",
            "assets:create", "assets:read", "assets:update", "assets:delete",
            "tasks:create", "tasks:read", "tasks:update", "tasks:delete",
            "reviews:create", "reviews:read", "reviews:approve",
            "audit:read", "settings:update", "users:manage",
        ]

    # Ensure role string matches one of frontend expected roles; fallback already Artist
    # Frontend role strings are display names, not codes.
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
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "is_superuser": getattr(user, "is_superuser", False),
        "created_at": user.created_at.isoformat() if getattr(user, "created_at", None) else "",
        "updated_at": user.updated_at.isoformat() if getattr(user, "updated_at", None) else "",
    }
