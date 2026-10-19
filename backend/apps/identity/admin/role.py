from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.identity.models import Role


@admin.register(Role)
class RoleAdmin(PlatformScopedModelAdmin):
    list_display = (
        "name",
        "code",
        "role_type",
        "scope",
        "priority",
        "is_system",
        "is_default",
        "is_active",
    )

    list_filter = ("role_type", "scope", "is_system", "is_default", "is_active")

    search_fields = ("name", "code", "description")

    readonly_fields = ("code",)

    ordering = ("priority", "name")
