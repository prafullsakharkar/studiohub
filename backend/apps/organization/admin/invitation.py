from django.contrib import admin

from apps.organization.models import Invitation


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "organization",
        "role",
        "status",
        "invited_by",
        "expires_at",
        "created_at",
    )

    list_filter = (
        "status",
        "organization",
    )

    search_fields = (
        "email",
        "organization__name",
    )

    readonly_fields = (
        "id",
        "accepted_at",
        "declined_at",
        "cancelled_at",
        "resent_at",
        "created_at",
        "updated_at",
    )
