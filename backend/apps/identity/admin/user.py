from django.contrib import admin

from apps.identity.models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "is_active",
        "is_staff",
        "is_email_verified",
        "last_seen",
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

    filter_horizontal = (
        "groups",
        "user_permissions",
    )

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "email",
                    "password",
                ),
            },
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "is_email_verified",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (
            "Important dates",
            {
                "fields": (
                    "last_login",
                    "last_seen",
                ),
            },
        ),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "password1",
                    "password2",
                ),
            },
        ),
    )
