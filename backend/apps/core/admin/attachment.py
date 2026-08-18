"""
Attachment admin configuration.
"""
from django.contrib import admin

from apps.core.models.attachment import Attachment


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    """
    Admin configuration for Attachment model.
    """

    list_display = (
        "name",
        "file_type",
        "mime_type",
        "file_size",
        "is_public",
        "expires_at",
        "created_at",
        "updated_at",
    )
    list_filter = ("file_type", "is_public", "created_at", "updated_at")
    search_fields = ("name", "description", "storage_key")
    readonly_fields = (
        "file_size",
        "storage_key",
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)
