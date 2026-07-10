from django.contrib import admin

from apps.identity.models import LoginAttempt


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = (
        "username",
        "ip_address",
        "successful",
        "locked_until",
        "attempted_at",
    )

    list_filter = ("successful",)

    search_fields = (
        "username",
        "ip_address",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
