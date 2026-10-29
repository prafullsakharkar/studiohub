from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.identity.models import UserRole


@admin.register(UserRole)
class UserRoleAdmin(PlatformScopedModelAdmin):
    list_display = (
        "user",
        "role",
        "created_at",
    )

    search_fields = ("user__email", "user__username", "role__name", "role__code")

    autocomplete_fields = ("user", "role")

    list_select_related = ("user", "role")
