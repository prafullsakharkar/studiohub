from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import (
    Review,
    ReviewActivity,
    ReviewAnnotation,
    ReviewComment,
    ReviewItem,
    ReviewNote,
    ReviewParticipant,
)


@admin.register(Review)
class ReviewAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = (
        "code",
        "title",
        "project",
        "entity_type",
        "entity_code",
        "status",
        "supervisor_verdict",
    )

    list_filter = (
        "status",
        "entity_type",
    )

    search_fields = (
        "code",
        "title",
        "entity_code",
    )

    autocomplete_fields = ("project", "lead_reviewer")

    list_select_related = ("project",)

    ordering = ("-created_at",)


class _ReviewPartAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    """The rows of a review (D-30) are written through the API; the admin is for looking."""

    list_filter = ("is_deleted",)
    raw_id_fields = ("review",)
    list_select_related = ("review",)
    ordering = ("-created_at",)


@admin.register(ReviewItem)
class ReviewItemAdmin(_ReviewPartAdmin):
    list_display = ("review", "version", "position", "is_deleted")
    raw_id_fields = ("review", "version")


@admin.register(ReviewParticipant)
class ReviewParticipantAdmin(_ReviewPartAdmin):
    list_display = ("review", "user", "name", "verdict", "verdict_at", "is_deleted")
    raw_id_fields = ("review", "user")


@admin.register(ReviewComment)
class ReviewCommentAdmin(_ReviewPartAdmin):
    list_display = ("review", "author_name", "text", "resolved_at", "is_deleted")
    raw_id_fields = ("review", "parent", "author", "resolved_by")


@admin.register(ReviewNote)
class ReviewNoteAdmin(_ReviewPartAdmin):
    list_display = ("review", "category", "author_name", "is_pinned", "is_deleted")
    raw_id_fields = ("review", "author")


@admin.register(ReviewAnnotation)
class ReviewAnnotationAdmin(_ReviewPartAdmin):
    list_display = ("review", "author_name", "frame_number", "is_deleted")
    raw_id_fields = ("review", "author")


@admin.register(ReviewActivity)
class ReviewActivityAdmin(_ReviewPartAdmin):
    list_display = ("review", "action", "verdict", "actor_email", "created_at")
    raw_id_fields = ("review", "actor")
