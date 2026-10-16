"""
Base selector for the Production bounded context.
"""

from __future__ import annotations

from apps.core.selectors.base import BaseSelector


class ProductionBaseSelector(BaseSelector):
    """
    Base selector for Production project-scoped entities.

    Provides strict project-membership scoping for Project, Shot, Asset,
    Task, Timelog, Version, Review, Media, Playlist, Workflow, and the
    project family (Sequence, Episode, Show, Editorial, Notes, Memberships).

    There is no organization partition: ``Project`` is the sole scope
    boundary. Scoping is fail closed, applying to every user, including
    staff:

      - Rows are always filtered to the caller's active ``ProjectMembership``
        set (per-project RBAC is canonical).
      - No authenticated user resolves to an empty queryset.
      - Superusers and holders of a global ADMIN-priority identity role
        keep platform-wide visibility (break-glass / platform admin).
    """

    @classmethod
    def _has_global_admin_role(cls, user) -> bool:
        """Platform-wide visibility for global ADMIN-priority role holders."""
        try:
            from apps.identity.choices.rbac import RolePriority
            from apps.identity.models import UserRole
        except Exception:  # noqa: BLE001
            return False
        try:
            return (
                UserRole.objects.filter(
                    user=user,
                    role__priority=RolePriority.ADMIN,
                    role__is_deleted=False,
                    is_deleted=False,
                ).exists()
            )
        except Exception:  # noqa: BLE001
            return False

    @classmethod
    def scope_by_project_membership(cls, qs, *, request):
        """
        Narrow a queryset to the caller's active ``ProjectMembership`` set.

        Superusers and global ADMIN-priority role holders see everything.
        Everyone else only sees entities belonging to projects they are
        explicitly an active member of:

        - models with a ``project`` FK → member projects only;
        - ``Project`` itself → the member project set;
        - ``Show`` → shows of project-wide memberships plus the shows bound
          to show-scoped memberships.
        """
        from django.db.models import Q

        from apps.production.models.project_membership import ProjectMembership

        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return qs.none()
        if getattr(user, "is_superuser", False):
            return qs
        if cls._has_global_admin_role(user):
            return qs

        memberships = ProjectMembership.objects.filter(
            user=user,
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
        scoping as live rows.
        """
        return cls.scope_by_project_membership(queryset, request=request)

    @classmethod
    def user_has_project_access(cls, *, request, project) -> bool:
        """
        Write/flow-level project access check.

        True for superusers, holders of a global ADMIN-priority identity
        role, or users with an active ProjectMembership on the project (a
        show-bound membership grants access to the project container for
        writes; entity records with their own show linkage are narrowed
        separately).
        """
        from apps.production.models.project_membership import ProjectMembership

        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return False
        if getattr(user, "is_superuser", False):
            return True
        if project is None:
            return False
        if cls._has_global_admin_role(user):
            return True

        return ProjectMembership.objects.filter(
            user=user,
            project=project,
            is_deleted=False,
            status__iexact="active",
        ).exists()
