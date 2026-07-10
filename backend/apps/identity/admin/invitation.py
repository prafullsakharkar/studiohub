from django.contrib import admin

from apps.identity.models import Invitation


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "organization",
        "role",
        "status",
        "expires_at",
        "created_at",
    )

    list_filter = ("status",)

    search_fields = (
        "email",
        "token",
    )

    readonly_fields = (
        "id",
        "token",
        "accepted_at",
        "created_at",
        "updated_at",
    )
