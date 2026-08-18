"""
Tag admin configuration.
"""
from django.contrib import admin

from apps.core.models.tag import Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """
    Admin configuration for Tag model.
    """

    list_display = (
        "name",
        "description",
        "color",
        "is_system",
        "created_at",
        "updated_at",
    )
    list_filter = ("is_system", "created_at", "updated_at")
    search_fields = ("name", "description")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("name",)
