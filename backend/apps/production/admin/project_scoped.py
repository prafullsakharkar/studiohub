from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import (
    EditorialCut,
    EditorialTrack,
    ProjectMembership,
    ProjectNote,
    ProjectNoteLink,
    ProjectNoteMention,
    Show,
)


@admin.register(ProjectMembership)
class ProjectMembershipAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
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
class EditorialCutAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
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
class EditorialTrackAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
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
class ShowAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "is_primary",
    )

    list_filter = ("is_primary",)


@admin.register(ProjectNote)
class ProjectNoteAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
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


@admin.register(ProjectNoteLink)
class ProjectNoteLinkAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    """Read-only: links are written by ``ProjectNoteService`` only, which checks them (RP-2, C-RP-07)."""

    list_display = ("note", "entity_type", "entity_id", "position", "created_at")
    list_filter = ("entity_type",)
    search_fields = ("entity_id",)
    readonly_fields = tuple(field.name for field in ProjectNoteLink._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ProjectNoteMention)
class ProjectNoteMentionAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    """Read-only: mentions are written by ``ProjectNoteService`` only, which checks them (RP-6, C-RP-25)."""

    list_display = ("note", "user", "position", "created_at")
    readonly_fields = tuple(field.name for field in ProjectNoteMention._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
