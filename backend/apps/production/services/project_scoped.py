"""
Services for project-scoped entities (memberships, notes).

EditorialCut is read-only through the API (seeded/managed server-side), so it
needs no service; memberships and notes follow the canonical
``BusinessService`` create/update/soft-delete/restore flow.
"""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model

from apps.core.services.business import BusinessService
from apps.production.models import ProjectMembership

# `add_member(show=...)`: not given (leave the binding alone), None (the whole project) or a show (bind to it).
UNSET: Any = object()


class ProjectMembershipService(BusinessService):
    model = ProjectMembership

    @classmethod
    def resolve_user(cls, *, user_ref=None, email=None):
        """Resolve a user by id or email (frontend sends either)."""
        from django.core.exceptions import ValidationError as DjangoValidationError

        user_model = get_user_model()
        if user_ref:
            try:
                user = user_model.objects.filter(id=user_ref).first()
            except (ValueError, TypeError, DjangoValidationError):
                user = None
            if user is not None:
                return user
        if email:
            return user_model.objects.filter(email__iexact=email).first()
        return None

    @classmethod
    def add_member(
        cls,
        *,
        project,
        user,
        role: str | None = None,
        roles: list[str] | None = None,
        role_ref=None,
        scope: str | None = None,
        status: str | None = None,
        vendor_id="",
        client_id="",
        team_id="",
        department_id="",
        show=UNSET,
    ):
        """Idempotent add: returns (membership, created).

        For a person who is already a member only what is named changes (CR-38): an add that names nobody's role or
        status leaves them as they are. A new member, and a restored one, get Artist / PROJECT / active for what is not named.
        Reuses soft-deleted rows (§12) instead of duplicating them.
        """
        membership = (
            ProjectMembership.all_objects.filter(
                project=project,
                user=user,
            ).first()
        )
        if membership is not None and not membership.is_deleted:
            membership.role = role or membership.role
            membership.roles = roles or membership.roles
            if role_ref is not None:
                membership.role_ref = role_ref
            membership.scope = scope or membership.scope
            membership.status = status or membership.status
            membership.vendor_id = vendor_id or membership.vendor_id
            membership.client_id = client_id or membership.client_id
            membership.team_id = team_id or membership.team_id
            membership.department_id = department_id or membership.department_id
            if show is not UNSET:
                membership.show = show
            membership.save()
            return membership, False
        if membership is not None:
            # Restore the soft-deleted row with fresh values.
            membership.is_deleted = False
            membership.deleted_at = None
            membership.role = role or "Artist"
            membership.roles = roles or [role or "Artist"]
            membership.role_ref = role_ref
            membership.scope = scope or "PROJECT"
            membership.status = status or "active"
            membership.vendor_id = vendor_id or ""
            membership.client_id = client_id or ""
            membership.team_id = team_id or ""
            membership.department_id = department_id or ""
            # A restored membership starts fresh, so a department it carried (settable since CR-37) does not come back.
            membership.department = ""
            membership.show = None if show is UNSET else show
            membership.save()
            return membership, False
        membership = ProjectMembership.objects.create(
            project=project,
            user=user,
            role=role or "Artist",
            roles=roles or [role or "Artist"],
            role_ref=role_ref,
            scope=scope or "PROJECT",
            status=status or "active",
            vendor_id=vendor_id or "",
            client_id=client_id or "",
            team_id=team_id or "",
            department_id=department_id or "",
            show=None if show is UNSET else show,
        )
        return membership, True


    @classmethod
    def update_member(cls, membership, **fields):
        """Change only the given fields of an existing membership (CR-37). ``scope`` follows ``show`` in ``save()``."""
        for name, value in fields.items():
            setattr(membership, name, value)
        membership.save()
        return membership

    @classmethod
    def remove_member(cls, membership, *, user=None):
        """Soft-delete the membership; re-adding the user restores it (CR-37)."""
        membership.delete(user=user)

