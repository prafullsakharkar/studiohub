"""
Base selector for the Production bounded context.
"""

from __future__ import annotations

from apps.core.selectors.base import BaseSelector


class ProductionBaseSelector(BaseSelector):
    """
    Base selector for Production organization-owned entities.

    Provides strict organization scoping for Project, Shot, Asset, Task,
    Timelog, Version, Review, Media, Playlist, and Workflow.

    Scoping is inherited from :class:`apps.core.selectors.base.BaseSelector`
    (``scope_by_request``) and is fail closed, applying to every user,
    including staff:

      - Rows are always filtered to the resolved request organization.
      - No organization context resolves to an empty queryset.
      - No staff/superuser bypass: the backend is authoritative and never
        exposes records belonging to another organization.
    """

    @classmethod
    def scope_by_project_membership(cls, qs, *, request):
        """
        Narrow an organization-scoped queryset to the caller's active
        ``ProjectMembership`` set (ADR-0033 D1: per-project RBAC is
        canonical; organization membership alone grants no production data).

        Org-wide production visibility requires a superuser or an active
        organization membership whose role has ``RolePriority.ADMIN``.
        Everyone else only sees entities belonging to projects (and shows)
        they are explicitly a member of:

        - models with a ``project`` FK → member projects only;
        - ``Project`` itself → the member project set;
        - ``Show`` → shows of project-wide memberships plus the shows bound
          to show-scoped memberships.
        """
        from django.db.models import Q

        from apps.organization.choices.role_priority import RolePriority
        from apps.production.models.project_membership import ProjectMembership

        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return qs.none()
        if getattr(user, "is_superuser", False):
            return qs

        organization = getattr(request, "organization", None)
        if organization is None:
            return qs.none()

        membership = getattr(request, "membership", None)
        role = getattr(membership, "role", None)
        if (
            membership is not None
            and getattr(membership, "status", None) == "active"
            and role is not None
            and not getattr(role, "is_deleted", False)
            and getattr(role, "priority", None) == RolePriority.ADMIN
        ):
            return qs

        memberships = ProjectMembership.objects.filter(
            user=user,
            organization=organization,
            is_deleted=False,
            status__iexact="active",
        )

        model = qs.model
        model_name = model.__name__
        if model_name == "Project":
            return qs.filter(pk__in=memberships.values_list("project_id", flat=True))
        if model_name == "Show":
            project_wide = memberships.filter(show__isnull=True)
            show_bound = memberships.exclude(show__isnull=True)
            return qs.filter(
                Q(project_id__in=project_wide.values_list("project_id", flat=True))
                | Q(pk__in=show_bound.values_list("show_id", flat=True))
            )

        field_names = {f.name for f in model._meta.fields}
        if "project" in field_names:
            return qs.filter(project_id__in=memberships.values_list("project_id", flat=True))

        return qs.none()

    @classmethod
    def scope_lifecycle_queryset(cls, queryset, *, request):
        """
        Hook consumed by ``apps.core.api.mixins.bulk.BulkActionsMixin`` for
        archive/restore/archived resolution: same project-membership
        scoping as live rows (ADR-0033 D1).
        """
        return cls.scope_by_project_membership(queryset, request=request)

    @classmethod
    def user_has_project_access(cls, *, request, project) -> bool:
        """
        ADR-0033 D1: write/flow-level project access check.

        True for superusers, org members holding an ADMIN-priority role, or
        users with an active ProjectMembership on the project (a show-bound
        membership grants access to the project container for writes; entity
        records with their own show linkage are narrowed separately).
        """
        from apps.organization.choices.role_priority import RolePriority
        from apps.production.models.project_membership import ProjectMembership

        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return False
        if getattr(user, "is_superuser", False):
            return True

        organization = getattr(project, "organization", None) or getattr(
            request, "organization", None
        )
        if organization is None:
            return False

        membership = getattr(request, "membership", None)
        role = getattr(membership, "role", None)
        if (
            membership is not None
            and getattr(membership, "status", None) == "active"
            and getattr(membership, "organization_id", None) == organization.pk
            and role is not None
            and not getattr(role, "is_deleted", False)
            and getattr(role, "priority", None) == RolePriority.ADMIN
        ):
            return True

        return ProjectMembership.objects.filter(
            user=user,
            organization=organization,
            project=project,
            is_deleted=False,
            status__iexact="active",
        ).exists()
