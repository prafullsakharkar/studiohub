from django.contrib import admin

from apps.intelligence.models import KnowledgeDocument
from apps.organization.admin.base import OrganizationScopedModelAdmin


@admin.register(KnowledgeDocument)
class KnowledgeDocumentAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "title",
        "slug",
        "organization",
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
        "organization",
    )

    search_fields = (
        "title",
        "slug",
        "summary",
        "author_name",
    )

    autocomplete_fields = ("organization",)

    list_select_related = ("organization",)

    ordering = ("title",)
