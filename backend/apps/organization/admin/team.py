from django.contrib import admin

from apps.organization.models import Team


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "department",
        "organization",
        "created_at",
    )

    list_filter = (
        "department",
        "organization",
    )

    search_fields = (
        "name",
        "code",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
