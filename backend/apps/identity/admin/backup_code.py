from django.contrib import admin

from apps.identity.models import BackupCode


@admin.register(BackupCode)
class BackupCodeAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "used",
        "used_at",
        "created_at",
    )

    list_filter = ("used",)

    search_fields = ("user__email",)

    readonly_fields = (
        "id",
        "code_hash",
        "used_at",
        "created_at",
        "updated_at",
    )
