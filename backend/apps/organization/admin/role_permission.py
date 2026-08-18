from django.contrib import admin

from apps.organization.models import RolePermission


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = (
        "role",
        "permission",
        "granted",
        "granted_by",
        "created_at",
    )

    list_filter = (
        "granted",
        "role",
        "permission",
    )

    search_fields = (
        "role__name",
        "permission__name",
    )

    readonly_fields = (
        "id",
        "granted_at",
        "expires_at",
        "created_at",
        "updated_at",
    )
