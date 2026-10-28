"""
Base selector for the Production bounded context.
"""

from __future__ import annotations

from typing import Any

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
      - A membership that names a vendor or a client is *external*: it shows
        only what that vendor/client was given (``external_scope``), never the
        whole project. A membership with neither is internal.
      - An internal membership bound to a show, or naming a department, is
        narrowed to it (``internal_scope``); a full one covers the project.
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
                    role__is_active=True,
                    role__is_deleted=False,
                    is_deleted=False,
                ).exists()
            )
        except Exception:  # noqa: BLE001
            return False

    @classmethod
    def is_platform_admin(cls, user) -> bool:
        """Superuser or global ADMIN-priority role holder (platform-wide scope)."""
        if user is None or not getattr(user, "is_authenticated", False):
            return False
        return bool(getattr(user, "is_superuser", False)) or cls._has_global_admin_role(user)

    @staticmethod
    def _active_memberships(user):
        from apps.production.models.project_membership import ProjectMembership

        return ProjectMembership.objects.filter(user=user, is_deleted=False, status__iexact="active")

    @classmethod
    def _internal_memberships(cls, user):
        """Active memberships that name neither a vendor nor a client."""
        return cls._active_memberships(user).filter(vendor_id="", client_id="")

    @classmethod
    def _full_memberships(cls, user):
        """Internal memberships covering the whole project: bound to no show, naming no department."""
        return cls._internal_memberships(user).filter(
            show__isnull=True, department="", department_id=""
        )

    @classmethod
    def default_show_id(cls, request, project) -> Any:
        """
        The show a record the caller creates in ``project`` belongs to: their own, when their
        membership is bound to one (otherwise it would vanish from their own view); else ``None``.
        """
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False) or project is None:
            return None
        return (
            cls._internal_memberships(user)
            .filter(project=project, show__isnull=False)
            .values_list("show_id", flat=True)
            .first()
        )

    @classmethod
    def _internal_q(cls, model_name: str, memberships):
        """
        What the caller's internal memberships allow on ``model_name``: a full membership allows
        the whole project, a narrowed one the project narrowed by show / department
        (``internal_scope``).
        """
        from django.db.models import Q

        from apps.production.selectors import internal_scope

        combined = Q(pk__in=[])
        full_projects = []

        for membership in memberships:
            if not internal_scope.is_narrowed(membership):
                full_projects.append(membership.project_id)
                continue

            part = Q(project_id=membership.project_id)
            narrowing = internal_scope.predicate(
                model_name, internal_scope.narrowing_of(membership)
            )
            if narrowing is not None:
                part &= narrowing
            combined |= part

        if full_projects:
            combined |= Q(project_id__in=full_projects)

        return combined

    @classmethod
    def external_grants(cls, user) -> list[Any]:
        """What each of the caller's external memberships may be shown (see ``external_scope``)."""
        from apps.production.selectors.external_scope import Grant

        rows = (
            cls._active_memberships(user)
            .exclude(vendor_id="", client_id="")
            .values_list("project_id", "vendor_id", "client_id")
        )
        return [Grant(project_id, vendor, client, user) for project_id, vendor, client in rows]

    @classmethod
    def is_external_on(cls, request, project_id) -> bool:
        """
        Whether the caller is an external (vendor/client) member of ``project_id`` and not a
        platform administrator. Cached on the request: serializers ask once per row.
        """
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return False

        cached = getattr(request, "_external_project_ids", None)
        if cached is None:
            cached = (
                set()
                if cls.is_platform_admin(user)
                else {grant.project_id for grant in cls.external_grants(user)}
            )
            request._external_project_ids = cached

        return project_id in cached

    @classmethod
    def visible_project_ids(cls, request) -> list[Any] | None:
        """
        Ids of the projects in which the caller has full (internal) access, or ``None`` when
        nothing narrows them (platform admins). Unauthenticated callers belong to none.

        An external (vendor/client) membership is deliberately not listed, nor is one narrowed to a
        show or a department: callers use this to filter whole-project records (deliveries, published
        files, schedules), which would show those members what their narrowing hides. Per-entity
        narrowing for them is ``scope_by_project_membership``.
        """
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return []
        if cls.is_platform_admin(user):
            return None
        return list(cls._full_memberships(user).values_list("project_id", flat=True).distinct())

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

        from apps.production.selectors.external_scope import external_q

        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return qs.none()
        if getattr(user, "is_superuser", False):
            return qs
        if cls._has_global_admin_role(user):
            return qs

        memberships = cls._internal_memberships(user)
        grants = cls.external_grants(user)

        model = qs.model
        model_name = model.__name__
        external = external_q(model_name, grants) if grants else None

        if model_name == "Project":
            internal = Q(pk__in=memberships.values_list("project_id", flat=True))
        elif model_name == "Show":
            project_wide = memberships.filter(show__isnull=True)
            show_bound = memberships.exclude(show__isnull=True)
            internal = Q(project_id__in=project_wide.values_list("project_id", flat=True)) | Q(
                pk__in=show_bound.values_list("show_id", flat=True)
            )
        elif "project" in {f.name for f in model._meta.fields}:
            internal = cls._internal_q(model_name, memberships)
        else:
            return qs.none()

        return qs.filter(internal | external) if external is not None else qs.filter(internal)

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
        separately). An external member counts: they may work in the project,
        but what they can see there is narrowed per entity.
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

    @classmethod
    def user_has_full_project_access(cls, *, request, project) -> bool:
        """
        Whole-project access: like ``user_has_project_access`` but never for an external
        (vendor/client) member. Gates the views that summarize the project as a whole
        (counts, dashboard, schedule, members, notes, deliveries).
        """
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return False
        if getattr(user, "is_superuser", False):
            return True
        if project is None:
            return False
        if cls._has_global_admin_role(user):
            return True

        return cls._full_memberships(user).filter(project=project).exists()
