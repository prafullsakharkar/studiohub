from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.identity.models import Permission


@admin.register(Permission)
class PermissionAdmin(PlatformScopedModelAdmin):
    list_display = (
        "name",
        "code",
        "module",
        "action",
        "category",
        "is_system",
        "is_active",
        "sort_order",
    )

    list_filter = ("module", "action", "category", "is_system", "is_active")

    search_fields = ("name", "code", "description")

    ordering = ("module", "action", "name")
