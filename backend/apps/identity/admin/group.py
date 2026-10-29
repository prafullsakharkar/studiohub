from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.identity.models import Group


@admin.register(Group)
class GroupAdmin(PlatformScopedModelAdmin):
    list_display = (
        "name",
        "code",
        "is_system",
        "created_at",
    )

    list_filter = ("is_system",)

    search_fields = ("name", "code", "description")

    readonly_fields = ("code",)

    ordering = ("name",)
