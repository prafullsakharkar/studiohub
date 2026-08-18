from django.contrib import admin

from apps.organization.models import Position


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "department",
        "organization",
        "level",
        "is_managerial",
        "created_at",
    )

    list_filter = (
        "level",
        "is_managerial",
        "department",
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
