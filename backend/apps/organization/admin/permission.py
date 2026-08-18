from django.contrib import admin

from apps.organization.models import Permission


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "module",
        "action",
        "category",
        "is_system",
        "is_active",
        "created_at",
    )

    list_filter = (
        "module",
        "action",
        "category",
        "is_system",
        "is_active",
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
