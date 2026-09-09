from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.production.models import EditorialCut, ProjectMembership, ProjectNote


@admin.register(ProjectMembership)
class ProjectMembershipAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "user",
        "project",
        "organization",
        "role",
        "scope",
        "status",
    )

    list_filter = (
        "status",
        "scope",
        "role",
    )


@admin.register(EditorialCut)
class EditorialCutAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "organization",
        "cut_type",
        "status",
    )

    list_filter = (
        "status",
        "cut_type",
    )


@admin.register(ProjectNote)
class ProjectNoteAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "subject",
        "project",
        "organization",
        "category",
        "priority",
        "status",
    )

    list_filter = (
        "status",
        "category",
        "priority",
    )
