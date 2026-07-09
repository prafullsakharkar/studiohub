from django.contrib import admin

from apps.identity.models import LoginAttempt


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "ip_address",
        "attempts",
        "locked_until",
        "created_at",
    )

    search_fields = (
        "email",
        "ip_address",
    )

    readonly_fields = (
        "uuid",
        "created_at",
        "updated_at",
    )
