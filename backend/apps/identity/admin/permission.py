from django.contrib import admin

from apps.identity.models import Permission


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "module",
        "action",
        "created_at",
    )

    list_filter = (
        "module",
        "action",
    )

    search_fields = (
        "name",
        "code",
    )

    readonly_fields = (
        "uuid",
        "created_at",
        "updated_at",
    )
