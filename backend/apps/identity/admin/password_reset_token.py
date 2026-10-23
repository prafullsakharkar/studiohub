from django.contrib import admin

from apps.identity.models import PasswordResetToken


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):  # pyright: ignore[reportMissingTypeArgument]
    """
    Read-only admin for password reset tokens.

    Tokens are issued and consumed exclusively by ``PasswordResetService``.
    Only digests are stored; the digest is never displayed and no create/edit
    is permitted from the admin.
    """

    list_display = (
        "user",
        "expires_at",
        "used_at",
        "requested_ip",
        "created_at",
    )

    list_filter = (
        "used_at",
        "expires_at",
    )

    search_fields = ("user__email",)

    readonly_fields = (
        "id",
        "user",
        "expires_at",
        "used_at",
        "requested_ip",
        "created_at",
        "updated_at",
    )

    exclude = ("token_hash",)

    list_select_related = ("user",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
