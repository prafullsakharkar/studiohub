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
from apps.production.models import ProjectMembership, ProjectNote


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
        organization,
        project,
        user,
        role="Artist",
        roles=None,
        scope="PROJECT",
        vendor_id="",
        client_id="",
        team_id="",
        department_id="",
    ):
        """Idempotent add: returns (membership, created).

        Reuses soft-deleted rows (§12) instead of duplicating them.
        """
        membership = (
            ProjectMembership.all_objects.filter(
                organization=organization,
                project=project,
                user=user,
            ).first()
        )
        if membership is not None and not membership.is_deleted:
            membership.role = role or membership.role
            membership.roles = roles or membership.roles
            membership.scope = scope or membership.scope
            membership.status = "Active"
            membership.vendor_id = vendor_id or membership.vendor_id
            membership.client_id = client_id or membership.client_id
            membership.team_id = team_id or membership.team_id
            membership.department_id = department_id or membership.department_id
            membership.save()
            return membership, False
        if membership is not None:
            # Restore the soft-deleted row with fresh values.
            membership.is_deleted = False
            membership.deleted_at = None
            membership.role = role or "Artist"
            membership.roles = roles or [role or "Artist"]
            membership.scope = scope or "PROJECT"
            membership.status = "Active"
            membership.vendor_id = vendor_id or ""
            membership.client_id = client_id or ""
            membership.team_id = team_id or ""
            membership.department_id = department_id or ""
            membership.save()
            return membership, False
        membership = ProjectMembership.objects.create(
            organization=organization,
            project=project,
            user=user,
            role=role or "Artist",
            roles=roles or [role or "Artist"],
            scope=scope or "PROJECT",
            status="Active",
            vendor_id=vendor_id or "",
            client_id=client_id or "",
            team_id=team_id or "",
            department_id=department_id or "",
        )
        return membership, True


class ProjectNoteService(BusinessService):
    model = ProjectNote

    @classmethod
    def create_note(cls, *, user=None, organization, project, author=None, **fields):
        """Create a note with server-resolved ownership (author defaults to user)."""
        payload: dict[str, Any] = {
            "user": user,
            "organization": organization,
            "project": project,
            "author": author if author is not None else user,
            **fields,
        }
        return cls.create(**payload)
