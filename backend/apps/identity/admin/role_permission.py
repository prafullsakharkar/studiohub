from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.identity.models import RolePermission


@admin.register(RolePermission)
class RolePermissionAdmin(PlatformScopedModelAdmin):
    list_display = (
        "role",
        "permission",
        "granted",
        "granted_at",
        "expires_at",
    )

    list_filter = ("granted",)

    search_fields = ("role__name", "permission__name", "permission__code")

    autocomplete_fields = ("role", "permission")

    list_select_related = ("role", "permission")
