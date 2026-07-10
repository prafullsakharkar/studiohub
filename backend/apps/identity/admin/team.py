from django.contrib import admin

from apps.identity.models import Team


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "organization",
        "status",
        "created_at",
    )

    list_filter = ("status",)

    search_fields = (
        "name",
        "code",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
