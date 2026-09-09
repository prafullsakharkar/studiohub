from django.db import models

from apps.core.models.bases import EntityModel


class KnowledgeDocument(EntityModel):
    """
    Studio knowledge-base document (pipeline standards, guides, runbooks).

    Backs the intelligence knowledge endpoints with real persistence,
    replacing the former in-memory stub store.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="knowledge_documents",
        db_index=True,
    )
    title = models.CharField(max_length=255, db_index=True)
    slug = models.SlugField(max_length=255, db_index=True)
    summary = models.TextField(blank=True, default="")
    content_markdown = models.TextField(blank=True, default="")
    category = models.CharField(max_length=50, default="general", db_index=True)
    department_name = models.CharField(max_length=255, blank=True, default="")
    project_code = models.CharField(max_length=50, blank=True, default="")
    tags = models.JSONField(default=list, blank=True)
    author_name = models.CharField(max_length=255, blank=True, default="")
    author_role = models.CharField(max_length=255, blank=True, default="")
    author_avatar = models.URLField(max_length=500, blank=True, default="")
    version = models.CharField(max_length=20, default="1.0")
    is_pinned = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    views_count = models.PositiveIntegerField(default=0)
    likes_count = models.PositiveIntegerField(default=0)
    linked_entities = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "intelligence_knowledge_document"
        ordering = ("title",)
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "slug"],
                name="uq_knowledge_document_org_slug",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "category"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.slug})"
