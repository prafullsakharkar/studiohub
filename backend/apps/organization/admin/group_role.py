from django.contrib import admin

from apps.organization.models import GroupRole


@admin.register(GroupRole)
class GroupRoleAdmin(admin.ModelAdmin):
    list_display = (
        "group",
        "role",
        "created_at",
    )

    list_filter = (
        "group",
        "role",
    )

    search_fields = (
        "group__name",
        "role__name",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
