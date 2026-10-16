from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.intelligence.models import KnowledgeDocument


@admin.register(KnowledgeDocument)
class KnowledgeDocumentAdmin(PlatformScopedModelAdmin):
    list_display = (
        "title",
        "slug",
        "category",
        "version",
        "is_pinned",
        "is_verified",
        "views_count",
        "likes_count",
    )

    list_filter = (
        "category",
        "is_pinned",
        "is_verified",
    )

    search_fields = (
        "title",
        "slug",
        "summary",
        "author_name",
    )





    ordering = ("title",)
