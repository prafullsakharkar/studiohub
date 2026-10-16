from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.models import (
    EditorialCut,
    EditorialTrack,
    ProjectMembership,
    ProjectNote,
    Show,
)


@admin.register(ProjectMembership)
class ProjectMembershipAdmin(StudioHubModelAdmin):
    list_display = (
        "user",
        "project",
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
class EditorialCutAdmin(StudioHubModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "cut_type",
        "status",
    )

    list_filter = (
        "status",
        "cut_type",
    )


@admin.register(EditorialTrack)
class EditorialTrackAdmin(StudioHubModelAdmin):
    list_display = (
        "name",
        "project",
        "track_type",
        "track_number",
        "status",
    )

    list_filter = (
        "status",
        "track_type",
    )


@admin.register(Show)
class ShowAdmin(StudioHubModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "is_primary",
    )

    list_filter = ("is_primary",)


@admin.register(ProjectNote)
class ProjectNoteAdmin(StudioHubModelAdmin):
    list_display = (
        "subject",
        "project",
        "category",
        "priority",
        "status",
    )

    list_filter = (
        "status",
        "category",
        "priority",
    )
