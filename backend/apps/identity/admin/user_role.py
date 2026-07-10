from django.contrib import admin

from apps.identity.models import UserRole


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "role",
        "created_at",
    )

    list_filter = ("role",)

    search_fields = (
        "user__email",
        "role__name",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
