from rest_framework import serializers

from apps.intelligence.models import KnowledgeDocument


class KnowledgeDocumentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)

    class Meta:
        model = KnowledgeDocument
        fields = (
            "id",
            "title",
            "slug",
            "summary",
            "content_markdown",
            "category",
            "department_name",
            "project_code",
            "tags",
            "author_name",
            "author_role",
            "author_avatar",
            "version",
            "is_pinned",
            "is_verified",
            "views_count",
            "likes_count",
            "linked_entities",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "views_count",
            "likes_count",
            "linked_entities",
            "created_at",
            "updated_at",
        )


class KnowledgeDocumentUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeDocument
        fields = (
            "title",
            "slug",
            "summary",
            "content_markdown",
            "category",
            "department_name",
            "project_code",
            "tags",
            "author_name",
            "author_role",
            "author_avatar",
            "version",
            "is_pinned",
            "is_verified",
        )
