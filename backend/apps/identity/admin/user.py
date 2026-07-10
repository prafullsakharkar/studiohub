from django.contrib import admin

from apps.identity.models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "is_active",
        "is_staff",
        "is_email_verified",
        "created_at",
    )

    list_filter = (
        "is_active",
        "is_staff",
        "is_superuser",
    )

    search_fields = ("email",)

    ordering = ("email",)

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "last_login",
        "last_seen",
    )
