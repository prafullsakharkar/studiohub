from django.contrib import admin

from apps.organization.models import Role


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "role_type",
        "scope",
        "priority",
        "organization",
        "is_system",
        "is_default",
        "is_active",
        "created_at",
    )

    list_filter = (
        "role_type",
        "scope",
        "priority",
        "is_system",
        "is_default",
        "is_active",
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
