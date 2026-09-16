from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.production.models import (
    EditorialCut,
    EditorialTrack,
    ProjectMembership,
    ProjectNote,
    Show,
)


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


@admin.register(EditorialTrack)
class EditorialTrackAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "project",
        "organization",
        "track_type",
        "track_number",
        "status",
    )

    list_filter = (
        "status",
        "track_type",
    )


@admin.register(Show)
class ShowAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "organization",
        "is_primary",
    )

    list_filter = ("is_primary",)


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
