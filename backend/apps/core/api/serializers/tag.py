"""
Tag API serializers.
"""

from rest_framework import serializers

from apps.core.models.tag import Tag


class TagSerializer(serializers.ModelSerializer):
    """
    Base serializer for Tag.
    """

    class Meta:
        model = Tag
        fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
            "name",
            "description",
            "color",
            "is_system",
            "created_by",
            "updated_by",
            "deleted_by",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "deleted_by",
        )


class TagListSerializer(TagSerializer):
    """
    Serializer for Tag list.
    """

    class Meta(TagSerializer.Meta):
        pass


class TagDetailSerializer(TagSerializer):
    """
    Serializer for Tag detail.
    """

    class Meta(TagSerializer.Meta):
        pass


class TagCreateSerializer(TagSerializer):
    """
    Serializer for Tag creation.
    """

    class Meta(TagSerializer.Meta):
        fields = tuple(
            f
            for f in TagSerializer.Meta.fields
            if f
            not in (
                "id",
                "uuid",
                "created_at",
                "updated_at",
                "created_by",
                "updated_by",
                "deleted_by",
            )
        )


class TagUpdateSerializer(TagSerializer):
    """
    Serializer for Tag update.
    """

    class Meta(TagSerializer.Meta):
        fields = (
            "name",
            "description",
            "color",
            "is_system",
        )
